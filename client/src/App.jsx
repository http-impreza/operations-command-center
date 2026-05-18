import { useEffect, useState } from 'react';

const dashboardUrl = '/api/dashboard';
const followUpsUrl = '/api/follow-ups';
const blockedWorkflowUrl = '/api/blocked-workflow';
const handoffsUrl = '/api/handoffs';
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
const functionalViews = ['Dashboard', 'Follow-Up', 'Blocked Workflow', 'Shift Handoff'];
const fallbackFilterOptions = {
  departments: fallbackDepartments,
  owners: [],
  statuses: ['All Open'],
  priorities: ['High', 'Medium', 'Low'],
  blockerTypes: [
    'Blocked',
    'Follow-Up Needed',
    'Waiting on Signature',
    'Waiting on Provider',
    'Waiting on Pharmacy',
  ],
  shifts: ['All', 'AM', 'PM', 'NOC'],
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
const createReviewStatuses = ['Active', 'Follow-Up Needed', 'Waiting on Signature', 'Blocked'];
function App() {
  const [activeView, setActiveView] = useState('Dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [followUps, setFollowUps] = useState(null);
  const [blockedWorkflow, setBlockedWorkflow] = useState(null);
  const [handoffs, setHandoffs] = useState(null);
  const [error, setError] = useState('');
  const [selectedReview, setSelectedReview] = useState(null);
  const [selectedBlockedItem, setSelectedBlockedItem] = useState(null);
  const [selectedHandoff, setSelectedHandoff] = useState(null);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isHandoffDrawerOpen, setIsHandoffDrawerOpen] = useState(false);
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
  const [blockedWorkflowFilters, setBlockedWorkflowFilters] = useState({
    department: '',
    owner: '',
    blockerType: '',
    asOfDate: defaultAsOfDate,
  });
  const [handoffFilters, setHandoffFilters] = useState({
    shift: '',
    department: '',
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
        const response = await fetch(activeViewUrl(activeView, {
          dashboard: filters,
          followUps: followUpFilters,
          blockedWorkflow: blockedWorkflowFilters,
          handoffs: handoffFilters,
        }));

        if (!response.ok) {
          throw new Error(`${activeView} request failed with ${response.status}`);
        }

        const data = await response.json();

        if (!ignoreResponse) {
          if (activeView === 'Follow-Up') {
            setFollowUps(data);
          } else if (activeView === 'Blocked Workflow') {
            setBlockedWorkflow(data);
            setSelectedBlockedItem((current) => selectBlockedItemAfterRefresh(current, data));
          } else if (activeView === 'Shift Handoff') {
            setHandoffs(data);
            setSelectedHandoff((current) => selectHandoffAfterRefresh(current, data));
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
  }, [activeView, filters, followUpFilters, blockedWorkflowFilters, handoffFilters]);

  const rawFilterOptions =
    filterOptionsForView(activeView, {
      dashboard,
      followUps,
      blockedWorkflow,
      handoffs,
    }) ??
    dashboard?.filterOptions ??
    followUps?.filterOptions ??
    blockedWorkflow?.filterOptions ??
    handoffs?.filterOptions;
  const filterOptions = normalizeFilterOptions(rawFilterOptions);

  async function handleReviewAction(actionId) {
    if (!selectedReview) {
      return;
    }

    const actionFilters = filtersForView(activeView, {
      dashboard: filters,
      followUps: followUpFilters,
      blockedWorkflow: blockedWorkflowFilters,
    });

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
      } else if (activeView === 'Blocked Workflow') {
        await refreshBlockedWorkflow();
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

  async function refreshBlockedWorkflow() {
    const response = await fetch(buildBlockedWorkflowUrl(blockedWorkflowFilters));

    if (!response.ok) {
      throw new Error(`Blocked Workflow request failed with ${response.status}`);
    }

    setBlockedWorkflow(await response.json());
  }

  function handleBlockedWorkflowLocalAction(actionId) {
    if (!selectedBlockedItem) {
      return;
    }

    const timestamp = new Date().toISOString();
    const labels = {
      unblock: 'marked unblocked locally',
      reassign: 'reassign requested',
      more: 'opened more options',
    };
    const updatedReview = {
      ...selectedBlockedItem,
      priority: actionId === 'reassign' ? 'High' : selectedBlockedItem.priority,
      status: actionId === 'unblock' ? 'Due Soon' : selectedBlockedItem.status,
      blocker: actionId === 'unblock' ? '' : selectedBlockedItem.blocker,
      nextStep:
        actionId === 'reassign'
          ? 'Confirm revised owner and unblock path.'
          : selectedBlockedItem.nextStep,
      history: [
        {
          id: `local-${actionId}-${selectedBlockedItem.id}-${Date.now()}`,
          timestamp,
          label: labels[actionId],
        },
        ...(Array.isArray(selectedBlockedItem.history) ? selectedBlockedItem.history : []),
      ],
    };

    setSelectedBlockedItem(actionId === 'unblock' ? null : updatedReview);
    setBlockedWorkflow((current) => updateBlockedWorkflowLocally(current, updatedReview, actionId));
  }

  async function handleBlockedWorkflowPersistedAction(actionId) {
    if (!selectedBlockedItem) {
      return;
    }

    try {
      const response = await fetch(
        `/api/work-items/${selectedBlockedItem.id}/status${buildQueryString(blockedWorkflowFilters)}`,
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

      await response.json();
      setSelectedBlockedItem(null);
      await refreshBlockedWorkflow();
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleBlockedWorkflowItemAction(action, payload = {}) {
    if (!selectedBlockedItem) {
      return;
    }

    try {
      const response = await fetch(
        `/api/blocked-workflow/${selectedBlockedItem.id}/action${buildQueryString(
          blockedWorkflowFilters,
        )}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action, ...payload }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Blocked workflow action failed with ${response.status}`);
      }

      setBlockedWorkflow(result.blockedWorkflow);
      setSelectedBlockedItem(
        selectBlockedItemAfterRefresh(selectedBlockedItem, result.blockedWorkflow) ?? result.workItem,
      );
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
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
              blockedWorkflowFilters={blockedWorkflowFilters}
              filterOptions={filterOptions}
              followUpFilters={followUpFilters}
              handoffFilters={handoffFilters}
              onChangeBlockedWorkflowFilters={setBlockedWorkflowFilters}
              onChangeDashboardFilters={setFilters}
              onChangeFollowUpFilters={setFollowUpFilters}
              onChangeHandoffFilters={setHandoffFilters}
              onOpenCreate={() => {
                setSelectedReview(null);
                if (activeView === 'Shift Handoff') {
                  setIsHandoffDrawerOpen(true);
                } else {
                  setIsCreateDrawerOpen(true);
                }
              }}
            />
          )}
        </header>

        {((activeView === 'Dashboard' && !dashboard) ||
          (activeView === 'Follow-Up' && !followUps) ||
          (activeView === 'Blocked Workflow' && !blockedWorkflow) ||
          (activeView === 'Shift Handoff' && !handoffs)) &&
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
                title="Overdue Items"
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

        {activeView === 'Blocked Workflow' && blockedWorkflow && (
          <BlockedWorkflowView
            groupedItems={blockedWorkflow.groupedItems}
            onApplyItemAction={handleBlockedWorkflowItemAction}
            onApplyLocalAction={handleBlockedWorkflowLocalAction}
            onApplyPersistedAction={handleBlockedWorkflowPersistedAction}
            onSelectItem={setSelectedBlockedItem}
            ownerOptions={filterOptions.owners}
            selectedItem={selectedBlockedItem}
            summaryCards={blockedWorkflow.summaryCards}
          />
        )}

        {activeView === 'Shift Handoff' && handoffs && (
          <ShiftHandoffView
            handoffs={handoffs}
            onSelectItem={setSelectedHandoff}
            selectedItem={selectedHandoff}
          />
        )}

        {!functionalViews.includes(activeView) && <PlaceholderPage />}
      </main>

      {selectedReview && activeView !== 'Blocked Workflow' && (
        <ReviewDrawer
          review={selectedReview}
          onApplyAction={handleReviewAction}
          onClose={() => setSelectedReview(null)}
        />
      )}

      {isCreateDrawerOpen && (
        <CreateReviewDrawer
          filters={filtersForView(activeView, {
            dashboard: filters,
            followUps: followUpFilters,
            blockedWorkflow: blockedWorkflowFilters,
          })}
          ownerOptions={filterOptions.owners}
          onClose={() => setIsCreateDrawerOpen(false)}
          onCreated={async (nextDashboard) => {
            if (activeView === 'Follow-Up') {
              await refreshFollowUps();
            } else if (activeView === 'Blocked Workflow') {
              await refreshBlockedWorkflow();
            } else {
              setDashboard(nextDashboard);
            }
            setIsCreateDrawerOpen(false);
            setError('');
          }}
        />
      )}

      {isHandoffDrawerOpen && (
        <CreateHandoffDrawer
          filterOptions={filterOptions}
          filters={handoffFilters}
          onClose={() => setIsHandoffDrawerOpen(false)}
          onCreated={(nextHandoffs) => {
            setHandoffs(nextHandoffs);
            setIsHandoffDrawerOpen(false);
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
  if (activeView === 'Shift Handoff') {
    return '24 hour operational awareness feed';
  }

  if (activeView === 'Follow-Up') {
    return 'Full operational work queue';
  }

  if (activeView === 'Blocked Workflow') {
    return "Resolve what's getting in the way";
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
        <span className="brand-mark">PRC</span>
        <div>
          <strong>Parkside</strong>
          <span>Retirement Center</span>
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
  blockedWorkflowFilters,
  dashboardFilters,
  filterOptions,
  followUpFilters,
  handoffFilters,
  onChangeBlockedWorkflowFilters,
  onChangeDashboardFilters,
  onChangeFollowUpFilters,
  onChangeHandoffFilters,
  onOpenCreate,
}) {
  const filters = filtersForView(activeView, {
    dashboard: dashboardFilters,
    followUps: followUpFilters,
    blockedWorkflow: blockedWorkflowFilters,
    handoffs: handoffFilters,
  });
  const updateFilters = filterUpdaterForView(activeView, {
    dashboard: onChangeDashboardFilters,
    followUps: onChangeFollowUpFilters,
    blockedWorkflow: onChangeBlockedWorkflowFilters,
    handoffs: onChangeHandoffFilters,
  });

  return (
    <div className="filter-bar" aria-label={`${activeView} filters`}>
      {activeView === 'Shift Handoff' && (
        <label>
          <span>Shift</span>
          <select
            value={handoffFilters.shift}
            onChange={(event) =>
              onChangeHandoffFilters((current) => ({ ...current, shift: event.target.value }))
            }
          >
            <option value="">All Shifts</option>
            {filterOptions.shifts
              .filter((shift) => shift !== 'All')
              .map((shift) => (
                <option key={shift}>{shift}</option>
              ))}
          </select>
        </label>
      )}
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
      {activeView !== 'Shift Handoff' && (
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
      )}
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
      {activeView === 'Blocked Workflow' && (
        <label>
          <span>Blocker Type</span>
          <select
            value={blockedWorkflowFilters.blockerType}
            onChange={(event) =>
              onChangeBlockedWorkflowFilters((current) => ({
                ...current,
                blockerType: event.target.value,
              }))
            }
          >
            <option value="">All Blockers</option>
            {filterOptions.blockerTypes.map((blockerType) => (
              <option key={blockerType}>{blockerType}</option>
            ))}
          </select>
        </label>
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
        {activeView === 'Shift Handoff' ? '+ Add Handoff' : '+ New Item'}
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
  const queueLabel = queueKey === 'overdueReviews' ? 'Overdue' : 'Due Soon';

  return (
    <section className={`panel queue-panel ${className}`}>
      <PanelHeader title={title} count={items.length} />
      {items.length === 0 && <p className="empty-state">No items in this queue.</p>}
      {items.length > 0 && (
        <div className="review-queue-list">
          {items.map((item) => (
            <ReviewQueueRow
              item={item}
              key={item.id}
              onSelect={() => onSelectReview({ ...item, queueKey })}
              queueLabel={queueLabel}
              tone={tone}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewQueueRow({ item, onSelect, queueLabel, tone }) {
  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  }

  const note = item.notes || 'No note recorded.';
  const reviewType = item.reviewType || 'Work Item';
  const priorityToneValue = priorityTone(item.priority, tone);
  const initials = residentInitials(item.residentLabel);

  return (
    <button
      className="review-queue-row"
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      type="button"
    >
      <span className="queue-avatar" aria-hidden="true">{initials}</span>
      <div className="queue-row-main">
        <strong>{item.residentLabel}</strong>
        <span>{reviewType} &bull; {item.owner} &bull; Due {item.dueDate}</span>
        <p>{note}</p>
      </div>
      <div className="queue-row-pills">
        <StatusPill label={item.priority} tone={priorityToneValue} />
        <StatusPill label={queueLabel} tone="queue-status" />
      </div>
    </button>
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

function BlockedWorkflowView({
  groupedItems,
  onApplyItemAction,
  onApplyLocalAction,
  onApplyPersistedAction,
  onSelectItem,
  ownerOptions,
  selectedItem,
  summaryCards,
}) {
  const groups = Array.isArray(groupedItems) ? groupedItems : [];
  const cards = Array.isArray(summaryCards) ? summaryCards : [];
  const items = groups.flatMap((group) => group.items);

  return (
    <div className="blocked-workflow-layout">
      <section className="summary-grid compact-summary-grid blocked-summary-grid" aria-label="Blocked Workflow summary">
        {cards.map((card) => (
          <article className={`summary-card compact ${card.id}`} key={card.id}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="panel blocked-workflow-panel">
        <PanelHeader title="Blocked Items" count={items.length} />
        {items.length === 0 && (
          <p className="empty-state">No blocked items match the current filters.</p>
        )}
        {items.length > 0 && (
          <div className="blocked-table" role="table" aria-label="Blocked items">
            <div className="blocked-table-header" role="row">
              <span>Resident / Label</span>
              <span>Work Type</span>
              <span>Department</span>
              <span>Owner</span>
              <span>Blocker</span>
              <span>Since / Days Blocked</span>
              <span>Priority</span>
              <span>Next Step</span>
            </div>
            <div className="blocked-table-body">
              {items.map((item) => {
                const isSelected = selectedItem?.id === item.id;

                return (
                  <button
                    className={`blocked-table-row aging-${item.agingLevel || 'normal'} ${isSelected ? 'selected' : ''
                      }`}
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    type="button"
                  >
                    <strong>{item.residentLabel || 'Resident Label'}</strong>
                    <span>{item.reviewType || 'Work Item'}</span>
                    <span>{item.department || 'Unassigned'}</span>
                    <span>{item.owner || 'Unassigned'}</span>
                    <StatusPill label={item.blockerType || 'Blocked'} tone="blocked" />
                    <span>{item.blockedSince || 'No date'} / {item.daysBlocked ?? 0}d</span>
                    <StatusPill
                      label={item.priority || 'Medium'}
                      tone={priorityTone(item.priority, 'pending')}
                    />
                    <span>{item.nextStep || 'No next step recorded.'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <BlockedWorkflowDetailPanel
        item={selectedItem}
        onApplyItemAction={onApplyItemAction}
        onApplyLocalAction={onApplyLocalAction}
        onApplyPersistedAction={onApplyPersistedAction}
        ownerOptions={ownerOptions}
      />
    </div>
  );
}

function BlockedWorkflowDetailPanel({
  item,
  onApplyItemAction,
  onApplyLocalAction,
  onApplyPersistedAction,
  ownerOptions,
}) {
  const [isReassigning, setIsReassigning] = useState(false);
  const [nextOwner, setNextOwner] = useState('');
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [followUpNote, setFollowUpNote] = useState('');
  const [summaryText, setSummaryText] = useState('');

  if (!item) {
    return (
      <section className="panel blocked-detail-panel empty-detail">
        <h2>Select a blocked item to view resolution details.</h2>
      </section>
    );
  }

  const followUps = Array.isArray(item.followUps) ? item.followUps : [];
  const history = Array.isArray(item.history) ? item.history : [];
  const availableOwners = [
    ...new Set([...(Array.isArray(ownerOptions) ? ownerOptions : []), item.owner].filter(Boolean)),
  ];

  function startReassign() {
    setNextOwner(item.owner || availableOwners[0] || '');
    setIsReassigning(true);
    setIsMoreOpen(false);
  }

  async function confirmReassign() {
    await onApplyItemAction('reassign', { owner: nextOwner });
    setIsReassigning(false);
  }

  async function submitFollowUpNote(event) {
    event.preventDefault();
    await onApplyItemAction('add-note', { note: followUpNote });
    setFollowUpNote('');
    setIsAddingNote(false);
    setIsMoreOpen(false);
  }

  async function copySummary() {
    const text = `${item.residentLabel || 'Resident Label'} | ${item.blockerType || 'Blocked'} | Owner: ${item.owner || 'Unassigned'
      } | Next step: ${item.nextStep || 'No next step recorded.'}`;

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }

    setSummaryText(text);
    setIsMoreOpen(false);
  }

  return (
    <section className="panel blocked-detail-panel">
      <div className="blocked-detail-header">
        <div>
          <span className="drawer-kicker">{item.blockerType || 'Blocked'}</span>
          <h2>{item.residentLabel || 'Resident Label'}</h2>
        </div>
        <div className="blocked-detail-actions">
          <button type="button" onClick={() => onApplyPersistedAction('complete')}>
            Mark Next Step Complete
          </button>
          <button type="button" onClick={() => onApplyLocalAction('unblock')}>
            Unblock
          </button>
          <button type="button" onClick={startReassign}>
            Reassign
          </button>
          <div className="more-action-wrap">
            <button type="button" onClick={() => setIsMoreOpen((current) => !current)}>
              More
            </button>
            {isMoreOpen && (
              <div className="more-menu">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNote(true);
                    setIsMoreOpen(false);
                  }}
                >
                  Add Follow-Up Note
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onApplyItemAction('escalate');
                    setIsMoreOpen(false);
                  }}
                >
                  Escalate
                </button>
                <button type="button" onClick={copySummary}>
                  Copy Summary
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isReassigning && (
        <div className="inline-action-panel">
          <label>
            <span>New Owner</span>
            <select value={nextOwner} onChange={(event) => setNextOwner(event.target.value)}>
              {availableOwners.map((owner) => (
                <option key={owner}>{owner}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={confirmReassign}>
            Confirm Reassign
          </button>
          <button type="button" onClick={() => setIsReassigning(false)}>
            Cancel
          </button>
        </div>
      )}

      {isAddingNote && (
        <form className="inline-action-panel note-panel" onSubmit={submitFollowUpNote}>
          <label>
            <span>Follow-Up Note</span>
            <input
              value={followUpNote}
              onChange={(event) => setFollowUpNote(event.target.value)}
              placeholder="Add synthetic follow-up note."
            />
          </label>
          <button type="submit">Add Note</button>
          <button type="button" onClick={() => setIsAddingNote(false)}>
            Cancel
          </button>
        </form>
      )}

      {summaryText && (
        <div className="inline-action-panel summary-copy-panel">
          <label>
            <span>Copied Summary</span>
            <input readOnly value={summaryText} />
          </label>
        </div>
      )}

      <div className="blocked-detail-grid">
        <dl className="detail-list blocked-detail-list">
          <div>
            <dt>Work Type</dt>
            <dd>{item.reviewType || 'Work Item'}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{item.department || 'Unassigned'}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{item.owner || 'Unassigned'}</dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>{item.priority || 'Medium'}</dd>
          </div>
          <div>
            <dt>Due Date</dt>
            <dd>{item.dueDate || 'No date'}</dd>
          </div>
          <div>
            <dt>Blocked Since</dt>
            <dd>{item.blockedSince || 'No date'} / {item.daysBlocked ?? 0} days</dd>
          </div>
        </dl>

        <div className="blocked-detail-copy">
          <section>
            <h3>What's Blocking</h3>
            <p>{item.blocker || item.blockerType || 'No blocker recorded.'}</p>
          </section>
          <section>
            <h3>Next Step</h3>
            <p>{item.nextStep || 'No next step recorded.'}</p>
          </section>
          <section>
            <h3>Notes</h3>
            <p>{item.notes || 'No notes recorded.'}</p>
          </section>
        </div>
      </div>

      <div className="blocked-detail-lists">
        <section>
          <h3>Follow-Ups</h3>
          <ul className="drawer-checklist">
            {followUps.map((followUp) => (
              <li key={followUp}>{followUp}</li>
            ))}
            {followUps.length === 0 && <li>No follow-up items recorded.</li>}
          </ul>
        </section>
        <section>
          <h3>History</h3>
          <ol className="drawer-history">
            {history.map((event) => (
              <li key={event.id}>
                <p>{event.label}</p>
                <time dateTime={event.timestamp}>{formatActivityTime(event.timestamp)}</time>
              </li>
            ))}
            {history.length === 0 && (
              <li>
                <p>No history recorded.</p>
              </li>
            )}
          </ol>
        </section>
      </div>
    </section>
  );
}

function ShiftHandoffView({ handoffs, onSelectItem, selectedItem }) {
  const items = Array.isArray(handoffs.items) ? handoffs.items : [];

  return (
    <div className="handoff-layout">
      <div className="handoff-main">
        <section className="panel handoff-feed-panel">
          <div className="panel-header">
            <h2>24 Hour Book</h2>
            <span>{items.length} notes</span>
          </div>
          {items.length === 0 && (
            <p className="empty-state">No handoff items match the current filters.</p>
          )}
          <ol className="handoff-feed">
            {items.map((item) => {
              const isSelected = selectedItem?.id === item.id;

              return (
                <li key={item.id}>
                  <button
                    className={`handoff-feed-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSelectItem(item)}
                    type="button"
                  >
                    <time dateTime={item.occurredAt}>{formatHandoffTime(item.occurredAt)}</time>
                    <div className="handoff-feed-body">
                      <div className="handoff-feed-topline">
                        <StatusPill label={item.shift} tone="blocked" />
                        <StatusPill
                          label={item.priority}
                          tone={priorityTone(item.priority, 'pending')}
                        />
                        <span>{item.department}</span>
                      </div>
                      <strong>{item.residentLabel || 'Community Note'}</strong>
                      <p>{item.summary}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <HandoffDetailPanel item={selectedItem} />
      </div>
    </div>
  );
}

function HandoffDetailPanel({ item }) {
  if (!item) {
    return (
      <section className="panel handoff-detail-panel empty-detail">
        <h2>Select a handoff note to preview it.</h2>
      </section>
    );
  }

  return (
    <section className="panel handoff-detail-panel">
      <div className="handoff-detail-header">
        <div>
          <span className="drawer-kicker">{item.department}</span>
          <h2>{item.residentLabel || 'Community Note'}</h2>
          <p>{item.shift} &bull; {item.priority} &bull; {formatHandoffDateTime(item.occurredAt)}</p>
        </div>
      </div>

      <div className="blocked-detail-copy">
        <section>
          <h3>Note</h3>
          <p>{item.summary}</p>
        </section>
      </div>
    </section>
  );
}

function ReviewDrawer({ review, onApplyAction, onApplyLocalAction, onClose }) {
  const history = Array.isArray(review.history) ? review.history : [];
  const shouldShowBlocker = Boolean(review.blocker) && isBlockingStatus(review.status);

  return (
    <aside className="detail-drawer" aria-label="Operational item details">
      <div className="drawer-header">
        <div>
          <span className="drawer-kicker">Operational Item</span>
          <h2>{review.residentLabel}</h2>
          <p className="drawer-subtitle">{review.reviewType || 'Item Type'}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close item details">
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
            {shouldShowBlocker && (
              <div>
                <dt>Blocker</dt>
                <dd>{review.blocker}</dd>
              </div>
            )}
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

        {onApplyLocalAction && (
          <DrawerSection title="Operational Actions">
            <div className="drawer-actions">
              <button type="button" onClick={() => onApplyLocalAction('unblock')}>
                Mark Unblocked
              </button>
              <button type="button" onClick={() => onApplyLocalAction('escalate')}>
                Escalate
              </button>
              <button type="button" onClick={() => onApplyLocalAction('note')}>
                Add Follow-Up Note
              </button>
            </div>
          </DrawerSection>
        )}

        <DrawerSection title="Note">
          <p>{review.notes || 'No notes recorded.'}</p>
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
    status: 'Active',
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

    const requiredFields = ['residentLabel', 'owner', 'dueDate', 'priority', 'notes'];
    const missingField = requiredFields.find((field) => formData[field].trim() === '');

    if (missingField) {
      setFormError('Complete all required fields before creating the item.');
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
    <aside className="detail-drawer" aria-label="Create new item">
      <div className="drawer-header">
        <div>
          <span className="drawer-kicker">New Item</span>
          <h2>Create Item</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close create item">
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
          <span>Status</span>
          <select
            value={formData.status}
            onChange={(event) => updateField('status', event.target.value)}
          >
            {createReviewStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Item Type</span>
          <input
            value={formData.reviewType}
            onChange={(event) => updateField('reviewType', event.target.value)}
            placeholder="Service Plan Review"
          />
        </label>

        <label>
          <span>Note</span>
          <textarea
            value={formData.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            placeholder="Synthetic operational note."
            rows="3"
          />
        </label>

        <button className="submit-action" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Item'}
        </button>
      </form>
    </aside>
  );
}

function CreateHandoffDrawer({ filterOptions, filters, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    residentLabel: '',
    department: filters.department || 'Nursing',
    shift: filters.shift || 'AM',
    priority: 'Medium',
    summary: '',
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

    const requiredFields = ['department', 'shift', 'priority', 'summary'];
    const missingField = requiredFields.find((field) => String(formData[field]).trim() === '');

    if (missingField) {
      setFormError('Complete all required fields before adding the handoff.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const response = await fetch(`/api/handoffs${buildQueryString(filters)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Create handoff failed with ${response.status}`);
      }

      onCreated(result.handoffs);
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <aside className="detail-drawer" aria-label="Quick add handoff">
      <div className="drawer-header">
        <div>
          <span className="drawer-kicker">24 hour feed</span>
          <h2>Quick Add Handoff</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close quick add handoff">
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
            placeholder="Resident Maple or Community Note"
          />
        </label>

        <label>
          <span>Department</span>
          <select
            value={formData.department}
            onChange={(event) => updateField('department', event.target.value)}
          >
            {filterOptions.departments.map((department) => (
              <option key={department}>{department}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Shift</span>
          <select value={formData.shift} onChange={(event) => updateField('shift', event.target.value)}>
            <option>AM</option>
            <option>PM</option>
            <option>NOC</option>
          </select>
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
          <span>Note</span>
          <textarea
            value={formData.summary}
            onChange={(event) => updateField('summary', event.target.value)}
            placeholder="Concise handoff note."
            rows="3"
          />
        </label>

        <button className="submit-action" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding...' : 'Add Handoff'}
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

function activeViewUrl(activeView, filters) {
  if (activeView === 'Follow-Up') {
    return buildFollowUpsUrl(filters.followUps);
  }

  if (activeView === 'Blocked Workflow') {
    return buildBlockedWorkflowUrl(filters.blockedWorkflow);
  }

  if (activeView === 'Shift Handoff') {
    return buildHandoffsUrl(filters.handoffs);
  }

  return buildDashboardUrl(filters.dashboard);
}

function filterOptionsForView(activeView, payloads) {
  if (activeView === 'Follow-Up') {
    return payloads.followUps?.filterOptions;
  }

  if (activeView === 'Blocked Workflow') {
    return payloads.blockedWorkflow?.filterOptions;
  }

  if (activeView === 'Shift Handoff') {
    return payloads.handoffs?.filterOptions;
  }

  return payloads.dashboard?.filterOptions;
}

function filtersForView(activeView, filters) {
  if (activeView === 'Follow-Up') {
    return filters.followUps;
  }

  if (activeView === 'Blocked Workflow') {
    return filters.blockedWorkflow;
  }

  if (activeView === 'Shift Handoff') {
    return filters.handoffs;
  }

  return filters.dashboard;
}

function filterUpdaterForView(activeView, updaters) {
  if (activeView === 'Follow-Up') {
    return updaters.followUps;
  }

  if (activeView === 'Blocked Workflow') {
    return updaters.blockedWorkflow;
  }

  if (activeView === 'Shift Handoff') {
    return updaters.handoffs;
  }

  return updaters.dashboard;
}

function updateBlockedWorkflowLocally(current, updatedReview, actionId) {
  if (!current) {
    return current;
  }

  const nextGroups = current.groupedItems
    .map((group) => {
      const nextItems =
        actionId === 'unblock'
          ? group.items.filter((item) => item.id !== updatedReview.id)
          : group.items.map((item) => (item.id === updatedReview.id ? { ...item, ...updatedReview } : item));

      return {
        ...group,
        items: nextItems,
      };
    })
    .filter((group) => group.items.length > 0);
  const allItems = nextGroups.flatMap((group) => group.items);

  return {
    ...current,
    groupedItems: nextGroups,
    summaryCards: buildBlockedWorkflowSummaryCards(allItems),
  };
}

function selectBlockedItemAfterRefresh(current, data) {
  if (!current || !Array.isArray(data?.groupedItems)) {
    return null;
  }

  return data.groupedItems.flatMap((group) => group.items).find((item) => item.id === current.id) ?? null;
}

function selectHandoffAfterRefresh(current, data) {
  if (!current || !Array.isArray(data?.items)) {
    return null;
  }

  return data.items.find((item) => item.id === current.id) ?? null;
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

function buildBlockedWorkflowSummaryCards(items) {
  const providerCount = items.filter((item) => item.blockerType === 'Waiting on Provider').length;
  const pharmacyCount = items.filter((item) => item.blockerType === 'Waiting on Pharmacy').length;
  const signatureCount = items.filter((item) => item.blockerType === 'Waiting on Signature').length;

  return [
    {
      id: 'blocked',
      label: 'Total Blocked',
      value: items.length,
      detail: 'Open blocked work',
    },
    {
      id: 'provider',
      label: 'Waiting on Provider',
      value: providerCount,
      detail: 'Provider response needed',
    },
    {
      id: 'pharmacy',
      label: 'Waiting on Pharmacy',
      value: pharmacyCount,
      detail: 'Pharmacy follow-up needed',
    },
    {
      id: 'signature',
      label: 'Waiting on Signature',
      value: signatureCount,
      detail: 'Signature path blocked',
    },
    {
      id: 'other',
      label: 'Other Blockers',
      value: items.length - providerCount - pharmacyCount - signatureCount,
      detail: 'Needs owner resolution',
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

function residentInitials(label = '') {
  const words = label.split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join('');

  return (initials || 'R').toUpperCase();
}

function normalizeFilterOptions(options = {}) {
  return {
    departments: safeArray(options.departments, fallbackFilterOptions.departments),
    owners: safeArray(options.owners, fallbackFilterOptions.owners),
    statuses: safeArray(options.statuses, fallbackFilterOptions.statuses),
    priorities: safeArray(options.priorities, fallbackFilterOptions.priorities),
    blockerTypes: safeArray(options.blockerTypes, fallbackFilterOptions.blockerTypes),
    shifts: safeArray(options.shifts, fallbackFilterOptions.shifts),
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

function buildBlockedWorkflowUrl(filters) {
  return `${blockedWorkflowUrl}${buildQueryString(filters)}`;
}

function buildHandoffsUrl(filters) {
  return `${handoffsUrl}${buildQueryString(filters)}`;
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

  if (filters.blockerType) {
    params.set('blockerType', filters.blockerType);
  }

  if (filters.shift) {
    params.set('shift', filters.shift);
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
    return 'pending';
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

function formatHandoffTime(timestamp) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function formatHandoffDateTime(timestamp) {
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${month}/${day}/${year} ${hour}:${minute}`;
}

export default App;
