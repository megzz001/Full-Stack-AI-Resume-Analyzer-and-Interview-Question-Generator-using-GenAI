require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/database');

// Connect to the database on module load so serverless invocations can use it
connectDB();

const PORT = process.env.PORT || 3000;

// Start the server only when run directly (local dev). When required by a serverless
// platform like Vercel, export the `app` so the platform can invoke it.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;

