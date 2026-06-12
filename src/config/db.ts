import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloud_kitchen_inventory';

export const connectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB successfully connected.');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
};
