require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;
const runningOnRender = process.env.RENDER === 'true';
const renderRuntimeConcurrency = process.env.RENDER_WEB_CONCURRENCY;

if (runningOnRender && !renderRuntimeConcurrency && require.main === module) {
  console.error('Refusing to start the HTTP server during the Render build phase. Use the build command for install-only steps and the start command for node server.js.');
  process.exit(1);
}

// Start the server only when run directly (local dev). When required by a serverless
// platform like Vercel, export the `app` so the platform can invoke it.
if (require.main === module) {
  // connectDB is called by the app middleware in serverless; for local dev connect explicitly
  const connectDB = require('./src/config/database');
  connectDB().catch((err) => {
    console.error('Local DB connection failed:', err);
  });

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;

