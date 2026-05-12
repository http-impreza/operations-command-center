import express from 'express';
import { dashboardData } from './data/seedWorkItems.js';

const app = express();
const port = process.env.PORT || 3001;

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'operations-command-center-server',
  });
});

app.get('/api/dashboard', (_req, res) => {
  res.json(dashboardData);
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Operations Command Center server listening on http://127.0.0.1:${port}`);
});
