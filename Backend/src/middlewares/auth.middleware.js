const jwt = require('jsonwebtoken');
const tokenBlacklistModel = require('../models/blacklist.model');

function getTokenFromRequest(req) {
    const cookieToken = req.cookies?.token;
    const authHeader = req.headers.authorization;

    if (cookieToken) {
        return cookieToken.trim();
    }

    if (authHeader) {
        return authHeader.replace(/^Bearer\s+/i, '').trim();
    }

    return null;
}

async function authUser(req, res, next) {
    const token = getTokenFromRequest(req); // Extract token from cookies or Authorization header

    if (!token) {
        return res.status(401).json({
            message: 'Access denied. No token provided.'
        });
    }

    const isBlacklisted = await tokenBlacklistModel.findOne({ token });
    if (isBlacklisted) {
        return res.status(401).json({ message: 'Token blacklisted. Please log in again.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token.' });
    }
}

module.exports = { authUser };