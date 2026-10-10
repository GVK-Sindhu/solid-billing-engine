import express from 'express';
import dotenv from 'dotenv';
import { SubscriptionController } from './controllers/SubscriptionController';
import { runMigrationsAndSeeds } from '../infrastructure/database/migrate';

dotenv.config();

export const app = express();
app.use(express.json());

const subscriptionController = new SubscriptionController();

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Main renewal API endpoint
app.post('/api/renew', subscriptionController.renew);

const PORT = parseInt(process.env.PORT || '3000', 10);

export let server: any = null;

export async function startServer(port = PORT) {
  // Ensure tables and seeds are present in database
  try {
    await runMigrationsAndSeeds();
    console.log('Database schema and seeds verified.');
  } catch (err: any) {
    console.warn('Database initialization warning (will retry on query):', err.message);
  }

  return new Promise((resolve) => {
    server = app.listen(port, () => {
      console.log(`Billing Engine API running on port ${port}`);
      resolve(server);
    });
  });
}

// Start immediately when executed directly
if (require.main === module) {
  startServer();
}
