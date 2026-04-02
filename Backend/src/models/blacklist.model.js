const mongoose = require('mongoose');

const blacklistTokenSchema = new mongoose.Schema({   
    token:{
        type: String,
        required: [true,"token is required to be added in the blacklist schema"],
    },
},{
        timestamps: true
    });     

const tokenBlacklistModel = mongoose.model('TokenBlacklist', blacklistTokenSchema);

module.exports = tokenBlacklistModel;
