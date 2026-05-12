import express from 'express';
import {
  getDashboardPayload,
  initializeDatabase,
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

app.get('/api/dashboard', (_req, res) => {
  res.json(getDashboardPayload());
});

app.patch('/api/work-items/:id/status', (req, res) => {
  const { actionId } = req.body;

  if (!['complete', 'follow-up', 'signature', 'blocked'].includes(actionId)) {
    return res.status(400).json({
      error: 'Unsupported status action.',
    });
  }

  const result = updateWorkItemStatus(req.params.id, actionId);

  if (!result) {
    return res.status(404).json({
      error: 'Work item not found.',
    });
  }

  return res.json(result);
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Operations Command Center server listening on http://127.0.0.1:${port}`);
});
