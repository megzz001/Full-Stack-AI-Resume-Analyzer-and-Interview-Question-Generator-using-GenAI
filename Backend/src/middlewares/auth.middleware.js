const jwt = require('jsonwebtoken');
const tokenBlacklistModel = require('../models/blacklist.model');

function getTokenFromRequest(req) {
    const cookieToken = req.cookies?.token;
    const authHeader = req.headers.authorization;
    const headerToken = req.headers['x-auth-token'];
    const queryToken = req.query?.authToken;
    const bodyToken = req.body?.authToken;

    if (cookieToken) {
        return cookieToken.trim();
    }

    if (authHeader) {
        return authHeader.replace(/^Bearer\s+/i, '').trim();
    }

    if (headerToken) {
        return String(headerToken).trim();
    }

    if (queryToken) {
        return String(queryToken).trim();
    }

    if (bodyToken) {
        return String(bodyToken).trim();
    }

    return null;
}

function getTokenSourceDiagnostics(req) {
    return {
        hasCookieToken: Boolean(req.cookies?.token),
        hasAuthorizationHeader: Boolean(req.headers.authorization),
        hasXAuthTokenHeader: Boolean(req.headers['x-auth-token']),
        hasQueryAuthToken: Boolean(req.query?.authToken),
        hasBodyAuthToken: Boolean(req.body?.authToken),
        method: req.method,
        path: req.originalUrl,
        origin: req.headers.origin || null,
    };
}

async function authUser(req, res, next) {
    const token = getTokenFromRequest(req); // Extract token from cookies or Authorization header

    if (!token) {
        const debugEnabled = String(process.env.AUTH_DEBUG || '').toLowerCase() === 'true';
        return res.status(401).json({
            message: 'Access denied. No token provided.',
            ...(debugEnabled ? { debug: getTokenSourceDiagnostics(req) } : {})
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