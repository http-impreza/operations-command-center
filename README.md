# Operations Command Center

Local-only prototype for a lightweight assisted-living operations visibility dashboard.

This baseline creates the first project structure for a command-center style workflow prototype. It is intended to help show overdue work, blocked work, due-soon items, and recent activity using only fake/synthetic labels.

## Safety Notes

- Localhost-only development prototype.
- Public repo safe by default.
- Do not commit real resident names, DOBs, diagnoses, medications, documents, OCR text, PHI, or workplace-sensitive data.
- Keep future local database files in `data/`, which is ignored by Git except for `data/.gitkeep`.
- No auth, AI, Google Drive, external integrations, or deployment config are included in this baseline.

## Project Structure

```text
client/   Vite + React frontend
server/   Node.js + Express backend
data/     Ignored local data folder for future SQLite files
```

## Development

Install dependencies:

```bash
cd client
npm install

cd ../server
npm install
```

Run the client:

```bash
cd client
npm run dev
```

Run the server:

```bash
cd server
npm run dev
```

Server health check:

```bash
curl http://localhost:3001/health
```

## Build

```bash
cd client
npm run build
```

```bash
cd server
npm start
```
