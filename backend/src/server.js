const app = require('./app');
const env = require('./config/env');
const { connectMongoDB } = require('./config/db');
const { assertJWTConfiguration } = require('./utils/jwt');

const startServer = async (port = env.PORT) => {
  try {
    assertJWTConfiguration();
    await connectMongoDB();

    const server = app.listen(port, () => {
      console.log(`RESTIFY backend running on http://localhost:${port}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE' && port === Number(env.PORT)) {
        const fallbackPort = Number(env.PORT) + 1;
        console.warn(`Port ${env.PORT} is busy. Retrying on ${fallbackPort}.`);
        startServer(fallbackPort);
        return;
      }

      console.error('Failed to start RESTIFY backend:', error.code || 'ServerError');
      process.exit(1);
    });
  } catch (error) {
    if (error.code === 'AUTH_CONFIGURATION_ERROR') {
      console.error('JWT_SECRET must be set to a random value of at least 32 bytes.');
    } else {
      console.error(
        'RESTIFY backend could not start because MongoDB is unavailable:',
        error.name || 'StartupError'
      );
    }
    process.exit(1);
  }
};

startServer();
