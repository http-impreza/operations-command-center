export const dashboardData = {
  summaryCards: [
    {
      id: 'overdue',
      label: 'Overdue',
      value: 3,
      detail: 'Reviews past target date',
    },
    {
      id: 'blocked',
      label: 'Blocked',
      value: 2,
      detail: 'Waiting on outside follow-up',
    },
    {
      id: 'due-soon',
      label: 'Due Soon',
      value: 4,
      detail: 'Reviews due in the next 7 days',
    },
    {
      id: 'completed',
      label: 'Completed',
      value: 6,
      detail: 'Closed this week',
    },
  ],
  overdueReviews: [
    {
      id: 'review-alpha',
      residentLabel: 'Resident Alpha',
      department: 'Nursing',
      owner: 'Wellness Director',
      dueDate: '2026-05-06',
      priority: 'High',
      status: 'Overdue',
      reviewType: 'Service Plan Review',
      blocker: 'Waiting on signature packet',
      nextStep: 'Confirm signature packet is ready for review.',
      notes:
        'Synthetic coordination item for tracking review packet completion and owner follow-up.',
      signatureStatus: 'Signature needed',
      followUps: [
        'Confirm packet status with administrative coordinator.',
        'Notify owner when signature packet is ready.',
      ],
      history: [
        {
          id: 'history-alpha-1',
          timestamp: '2026-05-12T08:10:00-07:00',
          label: 'Review flagged for same-day follow-up.',
        },
        {
          id: 'history-alpha-2',
          timestamp: '2026-05-11T13:10:00-07:00',
          label: 'Review moved into overdue queue.',
        },
      ],
    },
    {
      id: 'review-bravo',
      residentLabel: 'Resident Bravo',
      department: 'Nursing',
      owner: 'LPN',
      dueDate: '2026-05-08',
      priority: 'High',
      status: 'Overdue',
      reviewType: 'Care Plan Review',
      blocker: 'Care team note pending',
      nextStep: 'Request final review note from care team.',
      notes:
        'Synthetic review record used to show unresolved operational handoff work.',
      signatureStatus: 'Not ready for signature',
      followUps: [
        'Request final note from care team lead.',
        'Update review status after note is received.',
      ],
      history: [
        {
          id: 'history-bravo-1',
          timestamp: '2026-05-12T09:25:00-07:00',
          label: 'Owner confirmed review is still waiting on note.',
        },
        {
          id: 'history-bravo-2',
          timestamp: '2026-05-10T10:15:00-07:00',
          label: 'Follow-up task assigned to RN reviewer.',
        },
      ],
    },
    {
      id: 'review-charlie',
      residentLabel: 'Resident Charlie',
      department: 'Administration',
      owner: 'Medical Records',
      dueDate: '2026-05-10',
      priority: 'Medium',
      status: 'Overdue',
      reviewType: 'Quarterly Review',
      blocker: 'Follow-up call needed',
      nextStep: 'Prepare follow-up call summary.',
      notes:
        'Synthetic item representing a review that needs documentation of prior follow-up.',
      signatureStatus: 'Pending review',
      followUps: [
        'Prepare call summary for review owner.',
        'Confirm whether additional follow-up is needed.',
      ],
      history: [
        {
          id: 'history-charlie-1',
          timestamp: '2026-05-12T07:55:00-07:00',
          label: 'Administrative coordinator added a follow-up reminder.',
        },
        {
          id: 'history-charlie-2',
          timestamp: '2026-05-10T14:40:00-07:00',
          label: 'Review became overdue.',
        },
      ],
    },
  ],
  dueSoonReviews: [
    {
      id: 'review-delta',
      residentLabel: 'Resident Delta',
      department: 'Nursing',
      owner: 'Resident Care Coordinator',
      dueDate: '2026-05-13',
      priority: 'High',
      status: 'Due Soon',
      reviewType: 'Service Plan Review',
      blocker: '',
      nextStep: 'Schedule service plan review huddle.',
      notes:
        'Synthetic upcoming review for coordinating huddle timing and owner readiness.',
      signatureStatus: 'Not started',
      followUps: [
        'Confirm huddle time with assigned owner.',
        'Check whether packet preparation has started.',
      ],
      history: [
        {
          id: 'history-delta-1',
          timestamp: '2026-05-11T16:20:00-07:00',
          label: 'Review moved into due-soon queue.',
        },
      ],
    },
    {
      id: 'review-echo',
      residentLabel: 'Resident Echo',
      department: 'Nursing',
      owner: 'Med Tech',
      dueDate: '2026-05-15',
      priority: 'Medium',
      status: 'Due Soon',
      reviewType: 'Care Plan Review',
      blocker: '',
      nextStep: 'Verify paperwork packet is complete.',
      notes:
        'Synthetic review item for checking packet completeness before owner sign-off.',
      signatureStatus: 'Packet review needed',
      followUps: [
        'Verify packet checklist completion.',
        'Route packet to owner after review.',
      ],
      history: [
        {
          id: 'history-echo-1',
          timestamp: '2026-05-12T08:45:00-07:00',
          label: 'Owner updated for upcoming review.',
        },
      ],
    },
    {
      id: 'review-foxtrot',
      residentLabel: 'Resident Foxtrot',
      department: 'Administration',
      owner: 'Executive Director',
      dueDate: '2026-05-17',
      priority: 'Medium',
      status: 'Due Soon',
      reviewType: 'Service Plan Review',
      blocker: 'Owner confirmation needed',
      nextStep: 'Confirm owner for family follow-up.',
      notes:
        'Synthetic review item showing ownership clarification before the next workflow step.',
      signatureStatus: 'Not ready for signature',
      followUps: [
        'Confirm responsible owner for family follow-up.',
        'Add owner response to review notes.',
      ],
      history: [
        {
          id: 'history-foxtrot-1',
          timestamp: '2026-05-11T11:05:00-07:00',
          label: 'Follow-up owner marked unclear.',
        },
      ],
    },
    {
      id: 'review-golf',
      residentLabel: 'Resident Golf',
      department: 'Activities',
      owner: 'Activities Director',
      dueDate: '2026-05-18',
      priority: 'Low',
      status: 'Due Soon',
      reviewType: 'Quarterly Review',
      blocker: '',
      nextStep: 'Review open notes before weekly check-in.',
      notes:
        'Synthetic low-priority review queued for routine operational check-in.',
      signatureStatus: 'Not started',
      followUps: [
        'Scan open notes for unresolved tasks.',
        'Update review status during weekly check-in.',
      ],
      history: [
        {
          id: 'history-golf-1',
          timestamp: '2026-05-10T15:30:00-07:00',
          label: 'Review added to upcoming queue.',
        },
      ],
    },
  ],
  blockedItems: [
    {
      id: 'blocked-hotel',
      residentLabel: 'Resident Hotel',
      department: 'Nursing',
      blockerType: 'Waiting on Provider',
      owner: 'Wellness Director',
      blockedSince: '2026-05-07',
      nextStep: 'Place follow-up call and document response.',
    },
    {
      id: 'blocked-india',
      residentLabel: 'Resident India',
      department: 'Business Office',
      blockerType: 'Waiting on Pharmacy',
      owner: 'Business Office Manager',
      blockedSince: '2026-05-09',
      nextStep: 'Request clarification status update.',
    },
  ],
  recentActivity: [
    {
      id: 'activity-1',
      timestamp: '2026-05-12T08:45:00-07:00',
      label: 'Owner updated for Resident Echo review.',
    },
    {
      id: 'activity-2',
      timestamp: '2026-05-12T07:30:00-07:00',
      label: 'Follow-up note added for Resident Hotel blocker.',
    },
    {
      id: 'activity-3',
      timestamp: '2026-05-11T16:20:00-07:00',
      label: 'Resident Delta review moved into due-soon queue.',
    },
    {
      id: 'activity-4',
      timestamp: '2026-05-11T13:10:00-07:00',
      label: 'Resident Alpha review marked overdue.',
    },
  ],
};
