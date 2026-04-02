const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require("cors")

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cookieParser());
app.use(express.json());
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}))

// require all the routes here
const authRoutes = require('./routes/auth.routes');
const interviewRoutes = require('./routes/interview.routes');

// use the routes here
app.use('/api/auth', authRoutes);
app.use('/api/interview', interviewRoutes);

module.exports = app;