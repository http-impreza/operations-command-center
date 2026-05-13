import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dashboardData } from './data/seedWorkItems.js';

const serverSourceDir = dirname(fileURLToPath(import.meta.url));

export const databasePath = resolve(
  serverSourceDir,
  '../../data/operations-command-center.sqlite',
);

const completedBaseline =
  dashboardData.summaryCards.find((card) => card.id === 'completed')?.value ?? 0;
const departments = [
  'Nursing',
  'Business Office',
  'Maintenance',
  'Kitchen',
  'Housekeeping',
  'Activities',
  'Administration',
];
const defaultAsOfDate = '2026-05-12';
const blockingStatuses = [
  'Blocked',
  'Follow-Up Needed',
  'Waiting on Signature',
  'Waiting on Provider',
  'Waiting on Pharmacy',
];

mkdirSync(dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_items (
      id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL,
      queue_type TEXT,
      department TEXT NOT NULL DEFAULT 'Nursing',
      resident_label TEXT NOT NULL,
      review_type TEXT,
      status TEXT NOT NULL,
      owner TEXT NOT NULL,
      due_date TEXT,
      priority TEXT,
      blocker TEXT,
      next_step TEXT NOT NULL,
      notes TEXT,
      signature_status TEXT,
      follow_ups TEXT NOT NULL DEFAULT '[]',
      history TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      work_item_id TEXT,
      timestamp TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  migrateDatabase();

  const existing = db.prepare('SELECT COUNT(*) AS count FROM work_items').get();

  if (existing.count === 0) {
    seedDatabase();
  }
}

export function resetDatabase() {
  db.close();
  rmSync(databasePath, { force: true });
}

export function getDashboardPayload(filters = {}) {
  const normalizedFilters = normalizeFilters(filters);
  const reviews = db
    .prepare(
      `
        SELECT * FROM work_items
        WHERE item_type = 'review'
        ORDER BY due_date ASC, resident_label ASC
      `,
    )
    .all()
    .map(mapReviewRow);

  const baseBlockedItems = db
    .prepare(
      `
        SELECT * FROM work_items
        WHERE item_type = 'blocked'
        ORDER BY updated_at DESC, resident_label ASC
      `,
    )
    .all()
    .map(mapBlockedRow);

  const filteredReviews = reviews.filter((review) => matchesFilters(review, normalizedFilters));
  const filteredBaseBlockedItems = baseBlockedItems.filter((item) =>
    matchesFilters(item, normalizedFilters),
  );
  const overdueReviews = filteredReviews.filter(
    (review) => isOpenReview(review) && review.dueDate < normalizedFilters.asOfDate,
  );
  const dueSoonReviews = filteredReviews.filter(
    (review) =>
      isOpenReview(review) &&
      review.dueDate >= normalizedFilters.asOfDate &&
      review.dueDate <= addDays(normalizedFilters.asOfDate, 7),
  );
  const completedCount = filteredReviews.filter((review) => review.status === 'Completed').length;
  const blockedItems = [
    ...filteredReviews.filter(isBlockedReview).map(mapReviewToBlockedItem),
    ...filteredBaseBlockedItems,
  ];

  return {
    summaryCards: buildSummaryCards({
      overdue: overdueReviews.length,
      blocked: blockedItems.length,
      dueSoon: dueSoonReviews.length,
      completed: completedBaselineForFilters(normalizedFilters) + completedCount,
    }),
    overdueReviews,
    dueSoonReviews,
    blockedItems,
    recentActivity: getRecentActivity(normalizedFilters),
    filterOptions: getFilterOptions(),
  };
}

export function updateWorkItemStatus(id, actionId, filters = {}) {
  const row = db.prepare('SELECT * FROM work_items WHERE id = ? AND item_type = ?').get(id, 'review');

  if (!row) {
    return null;
  }

  const review = mapReviewRow(row);
  const timestamp = new Date().toISOString();
  const update = reviewUpdateForAction(actionId);
  const updatedReview = {
    ...review,
    ...update,
    history: [
      {
        id: `history-${actionId}-${id}-${Date.now()}`,
        timestamp,
        label: activityLabelForAction(actionId),
      },
      ...review.history,
    ],
  };
  const activity = {
    id: `activity-${actionId}-${id}-${Date.now()}`,
    workItemId: id,
    timestamp,
    label: `${updatedReview.residentLabel} ${activityLabelForAction(actionId)}.`,
  };

  db.exec('BEGIN');
  try {
    db.prepare(
      `
        UPDATE work_items
        SET status = ?,
            priority = ?,
            blocker = ?,
            next_step = ?,
            signature_status = ?,
            history = ?,
            updated_at = ?
        WHERE id = ?
      `,
    ).run(
      updatedReview.status,
      updatedReview.priority,
      updatedReview.blocker,
      updatedReview.nextStep,
      updatedReview.signatureStatus,
      JSON.stringify(updatedReview.history),
      timestamp,
      id,
    );
    insertActivity(activity);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    workItem: updatedReview,
    activity,
    dashboard: getDashboardPayload(filters),
  };
}

export function createWorkItem(input, filters = {}) {
  const now = new Date().toISOString();
  const dueDate = normalizeText(input.dueDate);
  const department = normalizeDepartment(input.department);
  const residentLabel = normalizeText(input.residentLabel);
  const owner = normalizeText(input.owner);
  const priority = normalizeText(input.priority);
  const nextStep = normalizeText(input.nextStep);
  const reviewType = normalizeText(input.reviewType) || 'Service Plan Review';
  const blocker = normalizeText(input.blocker);
  const notes = normalizeText(input.notes) || 'Synthetic locally created review item.';

  const id = `review-${Date.now()}`;
  const status = dueDate < defaultAsOfDate ? 'Overdue' : 'Due Soon';
  const queueType = status === 'Overdue' ? 'overdueReviews' : 'dueSoonReviews';
  const history = [
    {
      id: `history-create-${id}`,
      timestamp: now,
      label: 'Work item created',
    },
  ];
  const followUps = ['Review new item details and assign next operational follow-up.'];
  const signatureStatus = 'Not started';
  const activity = {
    id: `activity-create-${id}`,
    workItemId: id,
    timestamp: now,
    label: 'Work item created',
  };

  db.exec('BEGIN');
  try {
    db.prepare(
      `
        INSERT INTO work_items (
          id,
          item_type,
          queue_type,
          department,
          resident_label,
          review_type,
          status,
          owner,
          due_date,
          priority,
          blocker,
          next_step,
          notes,
          signature_status,
          follow_ups,
          history,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      id,
      'review',
      queueType,
      department,
      residentLabel,
      reviewType,
      status,
      owner,
      dueDate,
      priority,
      blocker,
      nextStep,
      notes,
      signatureStatus,
      JSON.stringify(followUps),
      JSON.stringify(history),
      now,
      now,
    );
    insertActivity(activity);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    workItem: {
      id,
      queueKey: queueType,
      department,
      residentLabel,
      reviewType,
      status,
      owner,
      dueDate,
      priority,
      blocker,
      nextStep,
      notes,
      signatureStatus,
      followUps,
      history,
    },
    activity,
    dashboard: getDashboardPayload(filters),
  };
}

function seedDatabase() {
  const now = new Date().toISOString();
  const insertWorkItem = db.prepare(`
    INSERT INTO work_items (
      id,
      item_type,
      queue_type,
      department,
      resident_label,
      review_type,
      status,
      owner,
      due_date,
      priority,
      blocker,
      next_step,
      notes,
      signature_status,
      follow_ups,
      history,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    for (const review of dashboardData.overdueReviews) {
      insertReview(insertWorkItem, review, 'overdueReviews', now);
    }

    for (const review of dashboardData.dueSoonReviews) {
      insertReview(insertWorkItem, review, 'dueSoonReviews', now);
    }

    for (const item of dashboardData.blockedItems) {
      insertWorkItem.run(
        item.id,
        'blocked',
        null,
        item.department,
        item.residentLabel,
        'Blocked Item',
        'Blocked',
        item.owner,
        item.blockedSince,
        'High',
        item.blockerType,
        item.nextStep,
        'Synthetic blocked operational item.',
        '',
        JSON.stringify([]),
        JSON.stringify([]),
        now,
        now,
      );
    }

    for (const activity of dashboardData.recentActivity) {
      insertActivity({
        id: activity.id,
        workItemId: null,
        timestamp: activity.timestamp,
        label: activity.label,
      });
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function insertReview(statement, review, queueType, now) {
  statement.run(
    review.id,
    'review',
    queueType,
    review.department,
    review.residentLabel,
    review.reviewType,
    review.status,
    review.owner,
    review.dueDate,
    review.priority,
    review.blocker,
    review.nextStep,
    review.notes,
    review.signatureStatus,
    JSON.stringify(review.followUps),
    JSON.stringify(review.history),
    now,
    now,
  );
}

function insertActivity(activity) {
  db.prepare(
    `
      INSERT INTO activity_events (id, work_item_id, timestamp, label, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
  ).run(
    activity.id,
    activity.workItemId,
    activity.timestamp,
    activity.label,
    new Date().toISOString(),
  );
}

function mapReviewRow(row) {
  return {
    id: row.id,
    queueKey: row.queue_type,
    department: row.department,
    residentLabel: row.resident_label,
    reviewType: row.review_type,
    status: row.status,
    owner: row.owner,
    dueDate: row.due_date,
    priority: row.priority,
    blocker: row.blocker ?? '',
    nextStep: row.next_step,
    notes: row.notes,
    signatureStatus: row.signature_status,
    followUps: parseJson(row.follow_ups, []),
    history: parseJson(row.history, []),
  };
}

function mapBlockedRow(row) {
  return {
    id: row.id,
    department: row.department,
    residentLabel: row.resident_label,
    blockerType: row.blocker,
    owner: row.owner,
    blockedSince: row.due_date,
    nextStep: row.next_step,
  };
}

function mapReviewToBlockedItem(review) {
  return {
    id: review.id,
    department: review.department,
    residentLabel: review.residentLabel,
    blockerType: blockerTypeForReview(review),
    owner: review.owner,
    blockedSince: review.dueDate,
    nextStep: review.nextStep,
  };
}

function migrateDatabase() {
  const columns = db.prepare('PRAGMA table_info(work_items)').all();
  const hasDepartment = columns.some((column) => column.name === 'department');

  if (!hasDepartment) {
    db.exec("ALTER TABLE work_items ADD COLUMN department TEXT NOT NULL DEFAULT 'Nursing'");
    db.exec("UPDATE work_items SET department = 'Nursing' WHERE department IS NULL OR department = ''");
  }
}

function getRecentActivity(filters) {
  if (!filters.department && !filters.owner) {
    return db
      .prepare(
        `
          SELECT id, timestamp, label
          FROM activity_events
          ORDER BY timestamp DESC
          LIMIT 12
        `,
      )
      .all();
  }

  return db
    .prepare(
      `
        SELECT activity_events.id, activity_events.timestamp, activity_events.label
        FROM activity_events
        JOIN work_items ON work_items.id = activity_events.work_item_id
        WHERE (? = '' OR work_items.department = ?)
          AND (? = '' OR work_items.owner = ?)
        ORDER BY activity_events.timestamp DESC
        LIMIT 12
      `,
    )
    .all(filters.department, filters.department, filters.owner, filters.owner);
}

function getFilterOptions() {
  const owners = db
    .prepare(
      `
        SELECT DISTINCT owner
        FROM work_items
        ORDER BY owner ASC
      `,
    )
    .all()
    .map((row) => row.owner);
  const storedDepartments = db
    .prepare(
      `
        SELECT DISTINCT department
        FROM work_items
        ORDER BY department ASC
      `,
    )
    .all()
    .map((row) => row.department);

  return {
    departments: [...new Set([...departments, ...storedDepartments])],
    owners,
  };
}

function normalizeFilters(filters) {
  return {
    department: normalizeFilterValue(filters.department),
    owner: normalizeFilterValue(filters.owner),
    asOfDate: isDateString(filters.asOfDate) ? filters.asOfDate : defaultAsOfDate,
  };
}

function matchesFilters(item, filters) {
  if (filters.department && item.department !== filters.department) {
    return false;
  }

  if (filters.owner && item.owner !== filters.owner) {
    return false;
  }

  return true;
}

function isOpenReview(review) {
  return review.status !== 'Completed' && !isBlockedReview(review);
}

function isBlockedReview(review) {
  return blockingStatuses.includes(review.status);
}

function blockerTypeForReview(review) {
  if (review.status === 'Follow-Up Needed') {
    return 'Follow-Up Needed';
  }

  if (review.status === 'Waiting on Signature') {
    return 'Waiting on Signature';
  }

  if (review.status === 'Waiting on Provider') {
    return 'Waiting on Provider';
  }

  if (review.status === 'Waiting on Pharmacy') {
    return 'Waiting on Pharmacy';
  }

  return review.blocker || 'Blocked';
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function buildSummaryCards(values) {
  return [
    {
      id: 'overdue',
      label: 'Overdue',
      value: values.overdue,
      detail: 'Reviews past target date',
    },
    {
      id: 'blocked',
      label: 'Blocked',
      value: values.blocked,
      detail: 'Waiting on outside follow-up',
    },
    {
      id: 'due-soon',
      label: 'Due Soon',
      value: values.dueSoon,
      detail: 'Reviews due in the next 7 days',
    },
    {
      id: 'completed',
      label: 'Completed',
      value: values.completed,
      detail: 'Closed this week',
    },
  ];
}

function completedBaselineForFilters(filters) {
  return filters.department || filters.owner ? 0 : completedBaseline;
}

function reviewUpdateForAction(actionId) {
  if (actionId === 'complete') {
    return {
      status: 'Completed',
      priority: 'Low',
      blocker: '',
      signatureStatus: 'Complete',
      nextStep: 'No open next step.',
    };
  }

  if (actionId === 'follow-up') {
    return {
      status: 'Follow-Up Needed',
      priority: 'Medium',
      blocker: 'Follow-up needed',
      nextStep: 'Assign owner to complete follow-up.',
    };
  }

  if (actionId === 'signature') {
    return {
      status: 'Waiting on Signature',
      priority: 'High',
      blocker: 'Waiting on signature',
      signatureStatus: 'Signature needed',
      nextStep: 'Route packet for signature and confirm completion.',
    };
  }

  return {
    status: 'Blocked',
    priority: 'High',
    blocker: 'Operational blocker needs resolution',
    nextStep: 'Identify blocker owner and document resolution path.',
  };
}

function activityLabelForAction(actionId) {
  if (actionId === 'complete') {
    return 'marked complete';
  }

  if (actionId === 'follow-up') {
    return 'marked follow-up needed';
  }

  if (actionId === 'signature') {
    return 'marked waiting on signature';
  }

  return 'marked blocked';
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function isDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeFilterValue(value) {
  const normalized = normalizeText(value);

  if (normalized === '' || normalized.startsWith('All ')) {
    return '';
  }

  return normalized;
}

function normalizeDepartment(value) {
  const normalized = normalizeText(value);

  return departments.includes(normalized) ? normalized : 'Nursing';
}
