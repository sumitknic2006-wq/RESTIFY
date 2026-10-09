const dotenv = require('dotenv');

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';

const env = {
  PORT: Number(process.env.PORT) || (NODE_ENV === 'development' ? 5001 : 5000),
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  CLIENT_URL:
    process.env.CLIENT_URL ||
    (NODE_ENV === 'production'
      ? 'https://restify-6no6.vercel.app'
      : 'http://localhost:5173'),
  NODE_ENV,
};

module.exports = env;
