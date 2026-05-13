import { useEffect, useState } from 'react';

const dashboardUrl = '/api/dashboard';
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
  'Reviews',
  'Tasks',
  'Residents',
  'Calendar',
  'Reports',
  'Documents',
  'Settings',
];

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
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [selectedReview, setSelectedReview] = useState(null);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [filters, setFilters] = useState({
    department: '',
    owner: '',
    asOfDate: defaultAsOfDate,
  });

  useEffect(() => {
    let ignoreResponse = false;

    async function loadDashboard() {
      try {
        const response = await fetch(buildDashboardUrl(filters));

        if (!response.ok) {
          throw new Error(`Dashboard request failed with ${response.status}`);
        }

        const data = await response.json();

        if (!ignoreResponse) {
          setDashboard(data);
          setError('');
        }
      } catch (requestError) {
        if (!ignoreResponse) {
          setError(requestError.message);
        }
      }
    }

    loadDashboard();

    return () => {
      ignoreResponse = true;
    };
  }, [filters]);

  const filterOptions = dashboard?.filterOptions ?? {
    departments: fallbackDepartments,
    owners: [],
  };

  async function handleReviewAction(actionId) {
    if (!selectedReview) {
      return;
    }

    try {
      const response = await fetch(
        `/api/work-items/${selectedReview.id}/status${buildQueryString(filters)}`,
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
      setDashboard(result.dashboard);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">Local prototype</p>
            <h1>Overview</h1>
            <p className="subtitle">Real-time operational status</p>
          </div>

          <div className="filter-bar" aria-label="Dashboard filters">
            <label>
              <span>Department</span>
              <select
                value={filters.department}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, department: event.target.value }))
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
                  setFilters((current) => ({ ...current, owner: event.target.value }))
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
            <label>
              <span>Operational Date</span>
              <input
                type="date"
                value={filters.asOfDate}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, asOfDate: event.target.value }))
                }
              />
            </label>
            <button
              className="primary-action"
              type="button"
              onClick={() => {
                setSelectedReview(null);
                setIsCreateDrawerOpen(true);
              }}
            >
              + New Review
            </button>
          </div>
        </header>

        {!dashboard && !error && <p className="status-message">Loading dashboard...</p>}

        {error && (
          <p className="status-message error" role="alert">
            Unable to load dashboard data. {error}
          </p>
        )}

        {dashboard && (
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
          filters={filters}
          ownerOptions={filterOptions.owners}
          onClose={() => setIsCreateDrawerOpen(false)}
          onCreated={(nextDashboard) => {
            setDashboard(nextDashboard);
            setIsCreateDrawerOpen(false);
            setError('');
          }}
        />
      )}
    </div>
  );
}

function Sidebar() {
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
          <a className={item === 'Dashboard' ? 'active' : ''} href="#dashboard" key={item}>
            {item}
          </a>
        ))}
      </nav>
    </aside>
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

function ReviewDrawer({ review, onApplyAction, onClose }) {
  return (
    <aside className="detail-drawer" aria-label="Review details">
      <div className="drawer-header">
        <div>
          <span className="drawer-kicker">{review.reviewType}</span>
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
              <dd>{review.signatureStatus}</dd>
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
          <p>{review.nextStep}</p>
        </DrawerSection>

        <DrawerSection title="Notes">
          <p>{review.notes}</p>
        </DrawerSection>

        <DrawerSection title="Follow-Up Items">
          <ul className="drawer-checklist">
            {review.followUps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </DrawerSection>

        <DrawerSection title="Recent Activity">
          <ol className="drawer-history">
            {review.history.map((item) => (
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
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

function buildDashboardUrl(filters) {
  return `${dashboardUrl}${buildQueryString(filters)}`;
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
