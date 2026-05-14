import express from 'express';
import {
  createWorkItem,
  getBlockedWorkflowPayload,
  getDashboardPayload,
  getFollowUpPayload,
  initializeDatabase,
  updateBlockedWorkflowAction,
  updateWorkItemStatus,
} from './database.js';

const app = express();
const port = process.env.PORT || 3001;

initializeDatabase();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'operations-command-center-server',
  });
});

app.get('/api/dashboard', (req, res) => {
  res.json(getDashboardPayload(getDashboardFilters(req.query)));
});

app.get('/api/follow-ups', (req, res) => {
  res.json(getFollowUpPayload(getFollowUpFilters(req.query)));
});

app.get('/api/blocked-workflow', (req, res) => {
  res.json(getBlockedWorkflowPayload(getBlockedWorkflowFilters(req.query)));
});

app.post('/api/work-items', (req, res) => {
  const validationError = validateCreateWorkItem(req.body);

  if (validationError) {
    return res.status(400).json({
      error: validationError,
    });
  }

  return res.status(201).json(createWorkItem(req.body, getDashboardFilters(req.query)));
});

app.patch('/api/work-items/:id/status', (req, res) => {
  const { actionId } = req.body;

  if (!['complete', 'follow-up', 'signature', 'blocked'].includes(actionId)) {
    return res.status(400).json({
      error: 'Unsupported status action.',
    });
  }

  const result = updateWorkItemStatus(req.params.id, actionId, getDashboardFilters(req.query));

  if (!result) {
    return res.status(404).json({
      error: 'Work item not found.',
    });
  }

  return res.json(result);
});

app.patch('/api/blocked-workflow/:id/action', (req, res) => {
  const { action } = req.body;

  if (!['reassign', 'add-note', 'escalate'].includes(action)) {
    return res.status(400).json({
      error: 'Unsupported blocked workflow action.',
    });
  }

  const validationError = validateBlockedWorkflowAction(req.body);

  if (validationError) {
    return res.status(400).json({
      error: validationError,
    });
  }

  const result = updateBlockedWorkflowAction(
    req.params.id,
    action,
    req.body,
    getBlockedWorkflowFilters(req.query),
  );

  if (!result) {
    return res.status(404).json({
      error: 'Work item not found or action did not change the item.',
    });
  }

  return res.json(result);
});

function validateCreateWorkItem(body) {
  const requiredFields = ['residentLabel', 'owner', 'dueDate', 'priority', 'nextStep'];

  for (const field of requiredFields) {
    if (typeof body[field] !== 'string' || body[field].trim() === '') {
      return `${field} is required.`;
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
    return 'dueDate must use YYYY-MM-DD format.';
  }

  if (!['High', 'Medium', 'Low'].includes(body.priority)) {
    return 'priority must be High, Medium, or Low.';
  }

  return '';
}

function validateBlockedWorkflowAction(body) {
  if (body.action === 'reassign') {
    if (typeof body.owner !== 'string' || body.owner.trim() === '') {
      return 'owner is required.';
    }
  }

  if (body.action === 'add-note') {
    if (typeof body.note !== 'string' || body.note.trim() === '') {
      return 'note is required.';
    }
  }

  return '';
}

function getDashboardFilters(query) {
  return {
    department: query.department,
    owner: query.owner,
    asOfDate: query.asOfDate,
  };
}

function getFollowUpFilters(query) {
  return {
    department: query.department,
    owner: query.owner,
    status: query.status,
    priority: query.priority,
    asOfDate: query.asOfDate,
  };
}

function getBlockedWorkflowFilters(query) {
  return {
    department: query.department,
    owner: query.owner,
    blockerType: query.blockerType,
    asOfDate: query.asOfDate,
  };
}

app.listen(port, '127.0.0.1', () => {
  console.log(`Operations Command Center server listening on http://127.0.0.1:${port}`);
});
