import { useEffect, useState } from 'react';

const dashboardUrl = '/api/dashboard';
const followUpsUrl = '/api/follow-ups';
const defaultAsOfDate = '2026-05-12';
const fallbackDepartments = [
  'Nursing',
  'Business Office',
  'Maintenance',
  'Kitchen',
  'Housekeeping',
  'Activities',
  'Administration',
];

const navigationItems = [
  'Dashboard',
  'Follow-Up',
  'Blocked Workflow',
  'Shift Handoff',
  'Documents',
  'Activity Log',
  'Reports',
];
const functionalViews = ['Dashboard', 'Follow-Up'];
const fallbackFilterOptions = {
  departments: fallbackDepartments,
  owners: [],
  statuses: ['All Open'],
  priorities: ['High', 'Medium', 'Low'],
};

const reviewActions = [
  {
    id: 'complete',
    label: 'Mark Complete',
  },
  {
    id: 'follow-up',
    label: 'Mark Follow-Up Needed',
  },
  {
    id: 'signature',
    label: 'Mark Waiting on Signature',
  },
  {
    id: 'blocked',
    label: 'Mark Blocked',
  },
];

function App() {
  const [activeView, setActiveView] = useState('Dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [followUps, setFollowUps] = useState(null);
  const [error, setError] = useState('');
  const [selectedReview, setSelectedReview] = useState(null);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [filters, setFilters] = useState({
    department: '',
    owner: '',
    asOfDate: defaultAsOfDate,
  });
  const [followUpFilters, setFollowUpFilters] = useState({
    department: '',
    owner: '',
    status: 'All Open',
    priority: '',
    asOfDate: defaultAsOfDate,
  });

  useEffect(() => {
    let ignoreResponse = false;

    async function loadActiveView() {
      if (!functionalViews.includes(activeView)) {
        setError('');
        return;
      }

      try {
        const response =
          activeView === 'Follow-Up'
            ? await fetch(buildFollowUpsUrl(followUpFilters))
            : await fetch(buildDashboardUrl(filters));

        if (!response.ok) {
          throw new Error(`${activeView} request failed with ${response.status}`);
        }

        const data = await response.json();

        if (!ignoreResponse) {
          if (activeView === 'Follow-Up') {
            setFollowUps(data);
          } else {
            setDashboard(data);
          }
          setError('');
        }
      } catch (requestError) {
        if (!ignoreResponse) {
          setError(requestError.message);
        }
      }
    }

    loadActiveView();

    return () => {
      ignoreResponse = true;
    };
  }, [activeView, filters, followUpFilters]);

  const rawFilterOptions =
    (activeView === 'Follow-Up' ? followUps?.filterOptions : dashboard?.filterOptions) ??
    dashboard?.filterOptions ??
    followUps?.filterOptions;
  const filterOptions = normalizeFilterOptions(rawFilterOptions);

  async function handleReviewAction(actionId) {
    if (!selectedReview) {
      return;
    }

    const actionFilters = activeView === 'Follow-Up' ? followUpFilters : filters;

    try {
      const response = await fetch(
        `/api/work-items/${selectedReview.id}/status${buildQueryString(actionFilters)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ actionId }),
        },
      );

      if (!response.ok) {
        throw new Error(`Status update failed with ${response.status}`);
      }

      const result = await response.json();

      setSelectedReview(result.workItem);
      if (activeView === 'Follow-Up') {
        await refreshFollowUps();
      } else {
        setDashboard(result.dashboard);
      }
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function refreshFollowUps() {
    const response = await fetch(buildFollowUpsUrl(followUpFilters));

    if (!response.ok) {
      throw new Error(`Follow-Up request failed with ${response.status}`);
    }

    setFollowUps(await response.json());
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onChangeView={setActiveView} />

      <main className="main-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">Local prototype</p>
            <h1>{pageTitleForView(activeView)}</h1>
            <p className="subtitle">
              {subtitleForView(activeView)}
            </p>
          </div>

          {functionalViews.includes(activeView) && (
            <FilterBar
              activeView={activeView}
              dashboardFilters={filters}
              filterOptions={filterOptions}
              followUpFilters={followUpFilters}
              onChangeDashboardFilters={setFilters}
              onChangeFollowUpFilters={setFollowUpFilters}
              onOpenCreate={() => {
                setSelectedReview(null);
                setIsCreateDrawerOpen(true);
              }}
            />
          )}
        </header>

        {((activeView === 'Dashboard' && !dashboard) || (activeView === 'Follow-Up' && !followUps)) &&
          !error && <p className="status-message">Loading {activeView}...</p>}

        {error && (
          <p className="status-message error" role="alert">
            Unable to load dashboard data. {error}
          </p>
        )}

        {activeView === 'Dashboard' && dashboard && (
          <>
            <SummaryCards cards={dashboard.summaryCards} />

            <section className="operations-grid" aria-label="Operations dashboard">
              <ReviewsTable
                className="span-8"
                title="Overdue Reviews"
                items={dashboard.overdueReviews}
                queueKey="overdueReviews"
                tone="urgent"
                onSelectReview={setSelectedReview}
              />
              <BlockedItems items={dashboard.blockedItems} />
              <ReviewsTable
                className="span-8"
                title="Due Soon"
                items={dashboard.dueSoonReviews}
                queueKey="dueSoonReviews"
                tone="pending"
                onSelectReview={setSelectedReview}
              />
              <ActivityList items={dashboard.recentActivity} />
            </section>
          </>
        )}

        {activeView === 'Follow-Up' && followUps && (
          <FollowUpView items={followUps.items} onSelectReview={setSelectedReview} />
        )}

        {!functionalViews.includes(activeView) && <PlaceholderPage />}
      </main>

      {selectedReview && (
        <ReviewDrawer
          review={selectedReview}
          onApplyAction={handleReviewAction}
          onClose={() => setSelectedReview(null)}
        />
      )}

      {isCreateDrawerOpen && (
        <CreateReviewDrawer
          filters={activeView === 'Follow-Up' ? followUpFilters : filters}
          ownerOptions={filterOptions.owners}
          onClose={() => setIsCreateDrawerOpen(false)}
          onCreated={async (nextDashboard) => {
            if (activeView === 'Follow-Up') {
              await refreshFollowUps();
            } else {
              setDashboard(nextDashboard);
            }
            setIsCreateDrawerOpen(false);
            setError('');
          }}
        />
      )}
    </div>
  );
}

function pageTitleForView(activeView) {
  if (activeView === 'Dashboard') {
    return 'Overview';
  }

  return activeView;
}

function subtitleForView(activeView) {
  if (activeView === 'Follow-Up') {
    return 'Full operational work queue';
  }

  if (activeView === 'Dashboard') {
    return 'Real-time operational status';
  }

  return 'MVP planning placeholder';
}

function Sidebar({ activeView, onChangeView }) {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <span className="brand-mark">OC</span>
        <div>
          <strong>Operations</strong>
          <span>Command Center</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        {navigationItems.map((item) => (
          <button
            className={item === activeView ? 'active' : ''}
            key={item}
            onClick={() => {
              onChangeView(item);
            }}
            type="button"
          >
            {item}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function PlaceholderPage() {
  return (
    <section className="panel placeholder-panel">
      <h2>This page is planned for the MVP.</h2>
    </section>
  );
}

function FilterBar({
  activeView,
  dashboardFilters,
  filterOptions,
  followUpFilters,
  onChangeDashboardFilters,
  onChangeFollowUpFilters,
  onOpenCreate,
}) {
  const filters = activeView === 'Follow-Up' ? followUpFilters : dashboardFilters;
  const updateFilters =
    activeView === 'Follow-Up' ? onChangeFollowUpFilters : onChangeDashboardFilters;

  return (
    <div className="filter-bar" aria-label={`${activeView} filters`}>
      <label>
        <span>Department</span>
        <select
          value={filters.department}
          onChange={(event) =>
            updateFilters((current) => ({ ...current, department: event.target.value }))
          }
        >
          <option value="">All Departments</option>
          {filterOptions.departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Owner</span>
        <select
          value={filters.owner}
          onChange={(event) =>
            updateFilters((current) => ({ ...current, owner: event.target.value }))
          }
        >
          <option value="">All Owners</option>
          {filterOptions.owners.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </select>
      </label>
      {activeView === 'Follow-Up' && (
        <>
          <label>
            <span>Status</span>
            <select
              value={followUpFilters.status}
              onChange={(event) =>
                onChangeFollowUpFilters((current) => ({ ...current, status: event.target.value }))
              }
            >
              {filterOptions.statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Priority</span>
            <select
              value={followUpFilters.priority}
              onChange={(event) =>
                onChangeFollowUpFilters((current) => ({ ...current, priority: event.target.value }))
              }
            >
              <option value="">All Priorities</option>
              {filterOptions.priorities.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </label>
        </>
      )}
      <label>
        <span>Operational Date</span>
        <input
          type="date"
          value={filters.asOfDate}
          onChange={(event) =>
            updateFilters((current) => ({ ...current, asOfDate: event.target.value }))
          }
        />
      </label>
      <button className="primary-action" type="button" onClick={onOpenCreate}>
        + New Review
      </button>
    </div>
  );
}

function SummaryCards({ cards }) {
  return (
    <section className="summary-grid" aria-label="Dashboard summary">
      {cards.map((card) => (
        <article className={`summary-card ${card.id}`} key={card.id}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <p>{card.detail}</p>
        </article>
      ))}
    </section>
  );
}

function ReviewsTable({ className = '', title, items, queueKey, tone, onSelectReview }) {
  return (
    <section className={`panel table-panel ${className}`}>
      <PanelHeader title={title} count={items.length} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Resident</th>
              <th>Owner</th>
              <th>Due</th>
              <th>Priority</th>
              <th>Next Step</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                className="clickable-row"
                key={item.id}
                onClick={() => onSelectReview({ ...item, queueKey })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectReview({ ...item, queueKey });
                  }
                }}
                tabIndex={0}
              >
                <td>
                  <strong>{item.residentLabel}</strong>
                </td>
                <td>{item.owner}</td>
                <td>{item.dueDate}</td>
                <td>
                  <StatusPill label={item.priority} tone={priorityTone(item.priority, tone)} />
                </td>
                <td>{item.nextStep}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FollowUpView({ items, onSelectReview }) {
  const safeItems = Array.isArray(items) ? items : [];
  const summaryCards = buildFollowUpSummaryCards(safeItems);

  return (
    <div className="follow-up-layout">
      <section className="summary-grid compact-summary-grid" aria-label="Follow-Up summary">
        {summaryCards.map((card) => (
          <article className={`summary-card compact ${card.id}`} key={card.id}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="panel follow-up-panel">
        <PanelHeader title="Open Operational Work" count={safeItems.length} />
        {safeItems.length === 0 && (
          <p className="empty-state">No open work items match the current filters.</p>
        )}
        <div className="table-wrap follow-up-table-wrap">
          <table className="follow-up-table">
            <thead>
              <tr>
                <th>Resident</th>
                <th>Work Type</th>
                <th>Department</th>
                <th>Owner</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {safeItems.map((item) => (
                <tr
                  className="clickable-row"
                  key={item.id}
                  onClick={() => onSelectReview(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectReview(item);
                    }
                  }}
                  tabIndex={0}
                >
                  <td>
                    <strong>{item.residentLabel || 'Resident Label'}</strong>
                  </td>
                  <td>{item.reviewType || 'Work Item'}</td>
                  <td>{item.department || 'Unassigned'}</td>
                  <td>{item.owner || 'Unassigned'}</td>
                  <td>{item.dueDate || 'No date'}</td>
                  <td>
                    <StatusPill
                      label={item.queueStatus || item.status || 'Open'}
                      tone={statusTone(item.queueStatus || item.status)}
                    />
                  </td>
                  <td>
                    <StatusPill
                      label={item.priority || 'Medium'}
                      tone={priorityTone(item.priority, 'pending')}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ReviewDrawer({ review, onApplyAction, onClose }) {
  const followUps = Array.isArray(review.followUps) ? review.followUps : [];
  const history = Array.isArray(review.history) ? review.history : [];

  return (
    <aside className="detail-drawer" aria-label="Review details">
      <div className="drawer-header">
        <div>
          <span className="drawer-kicker">{review.reviewType || 'Work Item'}</span>
          <h2>{review.residentLabel}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close review details">
          Close
        </button>
      </div>

      <div className="drawer-body">
        <section className="drawer-section">
          <div className="drawer-status-row">
            <StatusPill label={review.status} tone={statusTone(review.status)} />
            <StatusPill label={review.priority} tone={priorityTone(review.priority, 'pending')} />
          </div>

          <dl className="detail-list">
            <div>
              <dt>Owner</dt>
              <dd>{review.owner}</dd>
            </div>
            <div>
              <dt>Due Date</dt>
              <dd>{review.dueDate}</dd>
            </div>
            <div>
              <dt>Signature</dt>
              <dd>{review.signatureStatus || 'Not started'}</dd>
            </div>
            <div>
              <dt>Blocker</dt>
              <dd>{review.blocker || 'None'}</dd>
            </div>
          </dl>
        </section>

        <DrawerSection title="Workflow Actions">
          <div className="drawer-actions">
            {reviewActions.map((action) => (
              <button key={action.id} type="button" onClick={() => onApplyAction(action.id)}>
                {action.label}
              </button>
            ))}
          </div>
        </DrawerSection>

        <DrawerSection title="Next Step">
          <p>{review.nextStep || 'No next step recorded.'}</p>
        </DrawerSection>

        <DrawerSection title="Notes">
          <p>{review.notes || 'No notes recorded.'}</p>
        </DrawerSection>

        <DrawerSection title="Follow-Up Items">
          <ul className="drawer-checklist">
            {followUps.map((item) => (
              <li key={item}>{item}</li>
            ))}
            {followUps.length === 0 && <li>No follow-up items recorded.</li>}
          </ul>
        </DrawerSection>

        <DrawerSection title="Recent Activity">
          <ol className="drawer-history">
            {history.map((item) => (
              <li key={item.id}>
                <p>{item.label}</p>
                <time dateTime={item.timestamp}>{formatActivityTime(item.timestamp)}</time>
              </li>
            ))}
          </ol>
        </DrawerSection>
      </div>
    </aside>
  );
}

function DrawerSection({ title, children }) {
  return (
    <section className="drawer-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function CreateReviewDrawer({ filters, ownerOptions, onClose, onCreated }) {
  const defaultOwner = ownerOptions.includes('Wellness Director')
    ? 'Wellness Director'
    : ownerOptions[0] || '';
  const [formData, setFormData] = useState({
    residentLabel: '',
    department: filters.department || 'Nursing',
    owner: defaultOwner,
    dueDate: '',
    priority: 'Medium',
    reviewType: 'Service Plan Review',
    nextStep: '',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field, value) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const requiredFields = ['residentLabel', 'owner', 'dueDate', 'priority', 'nextStep'];
    const missingField = requiredFields.find((field) => formData[field].trim() === '');

    if (missingField) {
      setFormError('Complete all required fields before creating the review.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const response = await fetch(`/api/work-items${buildQueryString(filters)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Create request failed with ${response.status}`);
      }

      onCreated(result.dashboard);
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <aside className="detail-drawer" aria-label="Create new review">
      <div className="drawer-header">
        <div>
          <span className="drawer-kicker">New work item</span>
          <h2>Create Review</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close create review">
          Close
        </button>
      </div>

      <form className="drawer-body create-form" onSubmit={handleSubmit}>
        {formError && (
          <p className="form-message error" role="alert">
            {formError}
          </p>
        )}

        <label>
          <span>Resident Label</span>
          <input
            value={formData.residentLabel}
            onChange={(event) => updateField('residentLabel', event.target.value)}
            placeholder="Resident Juliet"
          />
        </label>

        <label>
          <span>Department</span>
          <select
            value={formData.department}
            onChange={(event) => updateField('department', event.target.value)}
          >
            {fallbackDepartments.map((department) => (
              <option key={department}>{department}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Owner</span>
          <select
            value={formData.owner}
            onChange={(event) => updateField('owner', event.target.value)}
          >
            {ownerOptions.map((owner) => (
              <option key={owner}>{owner}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Due Date</span>
          <input
            type="date"
            value={formData.dueDate}
            onChange={(event) => updateField('dueDate', event.target.value)}
          />
        </label>

        <label>
          <span>Priority</span>
          <select
            value={formData.priority}
            onChange={(event) => updateField('priority', event.target.value)}
          >
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </label>

        <label>
          <span>Review Type</span>
          <input
            value={formData.reviewType}
            onChange={(event) => updateField('reviewType', event.target.value)}
            placeholder="Service Plan Review"
          />
        </label>

        <label>
          <span>Next Step</span>
          <textarea
            value={formData.nextStep}
            onChange={(event) => updateField('nextStep', event.target.value)}
            placeholder="Confirm owner and prepare review packet."
            rows="3"
          />
        </label>

        <label>
          <span>Optional Notes</span>
          <textarea
            value={formData.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            placeholder="Synthetic operational note."
            rows="3"
          />
        </label>

        <button className="submit-action" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Review'}
        </button>
      </form>
    </aside>
  );
}

function BlockedItems({ items }) {
  return (
    <section className="panel side-panel">
      <PanelHeader title="Blocked Items" count={items.length} />
      <ul className="queue-list">
        {items.map((item) => (
          <li key={item.id}>
            <div className="queue-row">
              <strong>{item.residentLabel}</strong>
              <StatusPill label={item.blockerType} tone="blocked" />
            </div>
            <p>{item.nextStep}</p>
            <div className="meta-row">
              <span>{item.owner}</span>
              <span>Since {item.blockedSince}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActivityList({ items }) {
  return (
    <section className="panel side-panel">
      <PanelHeader title="Recent Activity" count={items.length} />
      <ol className="activity-list">
        {items.map((item) => (
          <li key={item.id}>
            <span aria-hidden="true" />
            <div>
              <p>{item.label}</p>
              <time dateTime={item.timestamp}>{formatActivityTime(item.timestamp)}</time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PanelHeader({ title, count }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      <span>{count} open</span>
    </div>
  );
}

function StatusPill({ label, tone }) {
  return <span className={`status-pill ${tone || 'pending'}`}>{label}</span>;
}

function buildFollowUpSummaryCards(items) {
  const counts = items.reduce(
    (totals, item) => {
      const status = item.queueStatus || item.status;

      if (status === 'Overdue') {
        totals.overdue += 1;
      }

      if (status === 'Due Soon') {
        totals.dueSoon += 1;
      }

      if (isBlockingStatus(status)) {
        totals.blocked += 1;
      }

      totals.open += 1;

      return totals;
    },
    {
      overdue: 0,
      dueSoon: 0,
      blocked: 0,
      open: 0,
    },
  );

  return [
    {
      id: 'overdue',
      label: 'Overdue',
      value: counts.overdue,
      detail: 'Past operational date',
    },
    {
      id: 'due-soon',
      label: 'Due Soon',
      value: counts.dueSoon,
      detail: 'Due within 7 days',
    },
    {
      id: 'blocked',
      label: 'Blocked',
      value: counts.blocked,
      detail: 'Waiting on follow-up',
    },
    {
      id: 'open',
      label: 'Open',
      value: counts.open,
      detail: 'Matching current filters',
    },
  ];
}

function isBlockingStatus(status) {
  return [
    'Blocked',
    'Follow-Up Needed',
    'Waiting on Signature',
    'Waiting on Provider',
    'Waiting on Pharmacy',
  ].includes(status);
}

function normalizeFilterOptions(options = {}) {
  return {
    departments: safeArray(options.departments, fallbackFilterOptions.departments),
    owners: safeArray(options.owners, fallbackFilterOptions.owners),
    statuses: safeArray(options.statuses, fallbackFilterOptions.statuses),
    priorities: safeArray(options.priorities, fallbackFilterOptions.priorities),
  };
}

function safeArray(value, fallback) {
  return Array.isArray(value) ? value : fallback;
}

function buildDashboardUrl(filters) {
  return `${dashboardUrl}${buildQueryString(filters)}`;
}

function buildFollowUpsUrl(filters) {
  return `${followUpsUrl}${buildQueryString(filters)}`;
}

function buildQueryString(filters) {
  const params = new URLSearchParams();

  if (filters.department) {
    params.set('department', filters.department);
  }

  if (filters.owner) {
    params.set('owner', filters.owner);
  }

  if (filters.asOfDate) {
    params.set('asOfDate', filters.asOfDate);
  }

  if (filters.status && filters.status !== 'All Open') {
    params.set('status', filters.status);
  }

  if (filters.priority) {
    params.set('priority', filters.priority);
  }

  const queryString = params.toString();

  return queryString ? `?${queryString}` : '';
}

function statusTone(status) {
  if (status === 'Overdue' || status === 'Blocked') {
    return 'urgent';
  }

  if (status === 'Completed') {
    return 'complete';
  }

  if (status === 'Waiting on Signature') {
    return 'blocked';
  }

  return 'pending';
}

function priorityTone(priority, fallback) {
  if (priority === 'High') {
    return 'urgent';
  }

  if (priority === 'Medium') {
    return fallback;
  }

  return 'low';
}

function formatActivityTime(timestamp) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export default App;
