import express from 'express';

const app = express();
const port = process.env.PORT || 3001;

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'operations-command-center-server',
  });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Operations Command Center server listening on http://127.0.0.1:${port}`);
});
