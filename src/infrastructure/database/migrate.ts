import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { getDatabasePool } from './connection';

export async function runMigrationsAndSeeds(pool?: Pool): Promise<void> {
  const db = pool || getDatabasePool();
  
  const possiblePaths = [
    path.join(__dirname, 'init.sql'),
    path.join(process.cwd(), 'src/infrastructure/database/init.sql'),
    path.join(__dirname, '..', '..', 'src', 'infrastructure', 'database', 'init.sql'),
  ];

  let sql: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      sql = fs.readFileSync(p, 'utf8');
      break;
    }
  }

  if (!sql) {
    throw new Error('init.sql could not be found in any expected location.');
  }

  await db.query(sql);
}

// Allow direct CLI invocation
if (require.main === module) {
  runMigrationsAndSeeds()
    .then(() => {
      console.log('Database migrated and seeded successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
