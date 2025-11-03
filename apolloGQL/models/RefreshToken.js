const mongoose = require('mongoose');
const RefreshSchema = new mongoose.Schema({
    refreshToken: {
        type: String,
        required: true,
    },
    accessToken: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '1d', // token will be deleted 1d later
    },
});
const RefreshToken = mongoose.model('RefreshToken', RefreshSchema);

module.exports = RefreshToken;