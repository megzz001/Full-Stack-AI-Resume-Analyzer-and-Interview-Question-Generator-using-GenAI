const userModel = require('../models/user.model');
const bcrypt = require('bcryptjs');
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
/**
 * @name registerUser
 * @description This function handles the registration of a new user. It receives the user details from the request body, creates a new user in the database, and sends a response back to the client.
 * @access Public
 * @param {*} req 
 * @param {*} res 
 */
async function registerUser(req, res) { 
    try {
        const { username, email, password } = req.body; // Extract user details from the request body   
        if(!username || !email || !password) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }
        const isUserExist = await userModel.findOne({ 
            $or: [{username}, {email}]
         }); // Check if a user with the same username or email already exists
        if(isUserExist) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const hash = await bcrypt.hash(password, 10); // Hash the password before saving to the database
        // Create a new user instance
        const user = await userModel.create({ username, email, password: hash });
        const token = jwt.sign(
            { id: user._id, username: user.username }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1d' }); // Generate a JWT token for the newly registered user

        res.cookie('token', token);
        res.status(201).json({ 
            message: 'User registered successfully', 
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            },
            token
        });
    } catch (error) {
        console.error('Error registering user:', error);
        return res.status(500).json({ message: 'Server error' });
    }
}

/**
 * @name loginUser
 * @description This function handles the login of an existing user. It receives the user credentials from the request body, verifies them against the database, and sends a response back to the client with a JWT token if the credentials are valid.
 * @access Public
 * @param {*} req 
 * @param {*} res
 */

async function loginUser(req, res) {
    try {
        const { email, password } = req.body; // Extract user credentials from the request body
        if(!email || !password) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }
        const user = await userModel.findOne({ email }); // Find the user by email
        if(!user) {
            return res.status(400).json({
                message: 'Invalid email or password' 
            });
        }
        const isMatch = await bcrypt.compare(password, user.password); // Compare the provided password with the hashed password in the database
        if(!isMatch) {
            return res.status(400).json({ 
                message: 'Invalid email or password' 
            });
        }
        const token = jwt.sign(
            { id: user._id, username: user.username }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1d' }); // Generate a JWT token for the logged-in user
        res.cookie('token', token);
        res.status(200).json({ 
            message: 'User logged in successfully',
            user:{
                id:user._id,
                username : user.username,
                email:user.email
            } 
    });
    } catch (error) {
        console.error('Error logging in user:', error);
        return res.status(500).json({ message: 'Server error' });
    }
}

/**
 * @name logoutUser
 * @description This function handles the logout of a user. It blacklists the user's JWT token and clears the authentication cookie.
 * @access Public
 */

async function logoutUser(req, res) {
    try {
        const token = getTokenFromRequest(req); // Get token from cookie or Authorization header
        if (token) {
            await tokenBlacklistModel.create({ token }); // Add the token to the blacklist
        }
        res.clearCookie('token');
        // Add the token to the blacklist
        res.status(200).json({ message: 'User logged out successfully' });
    }
    catch (error) {
        console.error('Error logging out user:', error);
        return res.status(500).json({ message: 'Server error' });
    }
}

/**
 * @name getMe
 * @description This function retrieves the authenticated user's information.
 * @access Private
 */
async function getMeController(req, res) {
    try {
        const user = await userModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ user });
    } catch (error) {
        console.error('Error fetching user information:', error);
        return res.status(500).json({ message: 'Server error' });
    }
}

module.exports = {registerUser,loginUser,logoutUser,getMeController};