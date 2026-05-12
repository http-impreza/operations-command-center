import { databasePath, resetDatabase } from './database.js';

resetDatabase();

console.log(`Removed local SQLite database at ${databasePath}`);
