const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require("cors");
const connectDB = require('./config/database');

const app = express();

const defaultOrigins = ['https://cloudware-hierarchical-file-management-d0xj.onrender.com']
const envOrigins = String(process.env.CLIENT_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])]

app.use(cookieParser());
app.use(express.json());
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

// ensure DB connected before handling requests (lazy connect for serverless)
app.use(async (req, res, next) => {
    try {
        await connectDB();
        return next();
    } catch (err) {
        console.error('DB connection failed:', err);
        return res.status(500).json({ error: 'Database connection error' });
    }
});

// require all the routes here
const authRoutes = require('./routes/auth.routes');
const interviewRoutes = require('./routes/interview.routes');

// use the routes here
app.use('/api/auth', authRoutes);
app.use('/api/interview', interviewRoutes);

module.exports = app;