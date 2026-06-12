import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import { AuthService } from './modules/auth/auth.service';
import authRoutes from './modules/auth/auth.routes';
import ingredientsRoutes from './modules/ingredients/ingredients.routes';

dotenv.config();

const app = express();
app.use(cors({
  origin: '*'
}))
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Middleware to ensure DB connection and seed superadmin
let isInitialized = false;
app.use(async (req, res, next) => {
  try {
    await connectDB();
    if (!isInitialized) {
      const authService = new AuthService();
      await authService.seedSuperadmin();
      isInitialized = true;
    }
    next();
  } catch (error) {
    console.error('Database connection or seeding failed:', error);
    res.status(500).json({ error: 'Internal server error: Database initialization failed' });
  }
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/ingredients', ingredientsRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Cloud Kitchen Inventory API!', status: 'running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Start listening if not running on Vercel
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
