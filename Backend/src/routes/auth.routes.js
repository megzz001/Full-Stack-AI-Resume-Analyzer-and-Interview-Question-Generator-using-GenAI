const express = require('express');
const authRouter = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

authRouter.get('/test', (req, res) => {
    res.json({ message: 'Auth route is working!' });

});
/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
authRouter.post('/register', authController.registerUser);

/**
 * @route POST/api/auth/login
 * @description login user with email and password
 * @access Public
 */
authRouter.post("/login",authController.loginUser);

/**
 * @route POST/api/auth/logout
 * @description logout user by blacklisting the token and clearing the cookie
 * @access Public
 */
authRouter.post("/logout", authController.logoutUser);

// Backward-compatible alias for clients still using GET.
authRouter.get("/logout", authController.logoutUser);

/**
 * @route GET /api/auth/get-me
 * @description Get the authenticated user's information
 * @access Private
 */
authRouter.get('/get-me', authMiddleware.authUser,authController.getMeController);


module.exports = authRouter;