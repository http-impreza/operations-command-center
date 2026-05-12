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

mkdirSync(dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_items (
      id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL,
      queue_type TEXT,
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

  const existing = db.prepare('SELECT COUNT(*) AS count FROM work_items').get();

  if (existing.count === 0) {
    seedDatabase();
  }
}

export function resetDatabase() {
  db.close();
  rmSync(databasePath, { force: true });
}

export function getDashboardPayload() {
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

  const recentActivity = db
    .prepare(
      `
        SELECT id, timestamp, label
        FROM activity_events
        ORDER BY timestamp DESC
        LIMIT 12
      `,
    )
    .all();

  const overdueReviews = reviews.filter(
    (review) => review.queueKey === 'overdueReviews' && isOpenReview(review),
  );
  const dueSoonReviews = reviews.filter(
    (review) => review.queueKey === 'dueSoonReviews' && isOpenReview(review),
  );
  const completedCount = reviews.filter((review) => review.status === 'Completed').length;
  const blockedReviewItems = reviews.filter(isBlockedReview).map(mapReviewToBlockedItem);
  const blockedItems = [...blockedReviewItems, ...baseBlockedItems];

  return {
    summaryCards: buildSummaryCards({
      overdue: overdueReviews.length,
      blocked: blockedItems.length,
      dueSoon: dueSoonReviews.length,
      completed: completedBaseline + completedCount,
    }),
    overdueReviews,
    dueSoonReviews,
    blockedItems,
    recentActivity,
  };
}

export function updateWorkItemStatus(id, actionId) {
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
    db.prepare(
      `
        INSERT INTO activity_events (id, work_item_id, timestamp, label, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
    ).run(activity.id, activity.workItemId, activity.timestamp, activity.label, timestamp);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    workItem: updatedReview,
    activity,
    dashboard: getDashboardPayload(),
  };
}

function seedDatabase() {
  const now = new Date().toISOString();
  const insertWorkItem = db.prepare(`
    INSERT INTO work_items (
      id,
      item_type,
      queue_type,
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertActivity = db.prepare(`
    INSERT INTO activity_events (id, work_item_id, timestamp, label, created_at)
    VALUES (?, ?, ?, ?, ?)
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
      insertActivity.run(activity.id, null, activity.timestamp, activity.label, now);
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

function mapReviewRow(row) {
  return {
    id: row.id,
    queueKey: row.queue_type,
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
    residentLabel: review.residentLabel,
    blockerType: blockerTypeForReview(review),
    owner: review.owner,
    blockedSince: review.dueDate,
    nextStep: review.nextStep,
  };
}

function isOpenReview(review) {
  return review.status !== 'Completed' && !isBlockedReview(review);
}

function isBlockedReview(review) {
  return [
    'Blocked',
    'Follow-Up Needed',
    'Waiting on Signature',
    'Waiting on Provider',
    'Waiting on Pharmacy',
  ].includes(review.status);
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
