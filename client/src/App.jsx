import { useEffect, useState } from 'react';

const dashboardUrl = '/api/dashboard';

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

  useEffect(() => {
    let ignoreResponse = false;

    async function loadDashboard() {
      try {
        const response = await fetch(dashboardUrl);

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
  }, []);

  function handleReviewAction(actionId) {
    if (!selectedReview) {
      return;
    }

    const timestamp = new Date().toISOString();
    const updatedReview = applyReviewAction(selectedReview, actionId, timestamp);
    const activityEntry = {
      id: `local-${actionId}-${selectedReview.id}-${Date.now()}`,
      timestamp,
      label: `${updatedReview.residentLabel} ${activityLabelForAction(actionId)}.`,
    };

    setSelectedReview(updatedReview);
    setDashboard((currentDashboard) => {
      if (!currentDashboard) {
        return currentDashboard;
      }

      return {
        ...currentDashboard,
        overdueReviews: updateReviewCollection(currentDashboard.overdueReviews, updatedReview),
        dueSoonReviews: updateReviewCollection(currentDashboard.dueSoonReviews, updatedReview),
        recentActivity: [activityEntry, ...currentDashboard.recentActivity],
      };
    });
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
            <button type="button">All Departments</button>
            <button type="button">All Owners</button>
            <button type="button">May 12, 2026</button>
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
                tone="urgent"
                onSelectReview={setSelectedReview}
              />
              <BlockedItems items={dashboard.blockedItems} />
              <ReviewsTable
                className="span-8"
                title="Due Soon"
                items={dashboard.dueSoonReviews}
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

function ReviewsTable({ className = '', title, items, tone, onSelectReview }) {
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

function updateReviewCollection(items, updatedReview) {
  return items.map((item) => (item.id === updatedReview.id ? updatedReview : item));
}

function applyReviewAction(review, actionId, timestamp) {
  const actionUpdate = reviewUpdateForAction(actionId);

  return {
    ...review,
    ...actionUpdate,
    history: [
      {
        id: `history-${actionId}-${review.id}-${Date.now()}`,
        timestamp,
        label: activityLabelForAction(actionId),
      },
      ...review.history,
    ],
  };
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
