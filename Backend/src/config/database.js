const mongoose = require('mongoose');
require('dotenv').config();

async function connectDB() {
    if (mongoose.connection.readyState === 1) {
        // already connected
        return mongoose.connection;
    }

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        const err = new Error('MONGO_URI not set in environment');
        console.error(err);
        throw err;
    }

    try {
        await mongoose.connect(mongoUri, {
            // recommended options can be added here
        });
        console.log('Connected to MongoDB');
        return mongoose.connection;
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        // Do not exit process — let caller handle failures in serverless environments
        throw error;
    }
}

module.exports = connectDB;