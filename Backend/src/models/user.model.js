const mongoose = require('mongoose');
require('dotenv').config();

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: [true, 'Username already exists']
    },
    email: {    
        type: String,
        required: true,
        unique: [true, 'Email already exists']
    },
    password: { 
        type: String,
        required: true
    }
}, { timestamps: true });   

const userModel = mongoose.model('User', userSchema);

module.exports = userModel;