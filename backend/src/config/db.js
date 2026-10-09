const mongoose = require('mongoose');
const env = require('./env');

let databaseState = 'disconnected';

const setDatabaseState = (state) => {
  databaseState = state;
};

mongoose.connection.on('connected', () => {
  setDatabaseState('connected');
  console.log('MongoDB connected successfully');
});

mongoose.connection.on('error', (error) => {
  setDatabaseState('error');
  console.error('MongoDB connection error:', error.name || 'DatabaseError');
});

mongoose.connection.on('disconnected', () => {
  setDatabaseState('disconnected');
  console.warn('MongoDB disconnected');
});

async function connectMongoDB() {
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing. Add it to backend/.env before starting the server.');
  }

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    return mongoose.connection;
  } catch (error) {
    setDatabaseState('error');
    console.error('MongoDB connection failed:', error.name || 'DatabaseError');
    throw error;
  }
}

function getDatabaseStatus() {
  return {
    status: databaseState,
    configured: Boolean(env.MONGODB_URI),
  };
}

module.exports = {
  connectMongoDB,
  getDatabaseStatus,
  mongoose,
};
