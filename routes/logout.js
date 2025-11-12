//--------------------------------------------------------------------------------------------------//
// For backend and express
const express = require('express');
const mongoose = require('./db');
const { RefreshToken } = require('../model/models');
const logout = express.Router()
// const cors = require("cors");
const authenticateAccessToken = require('../middleware/authenticateAccessToken');




//--------------------------------------------------------------------------------------------------//
// This route handler processes user logout requests for the '/logout' path.

// Route handler for creating a new token
logout.post('/logout', authenticateAccessToken, async (req, resp) => {
    // 獲取當前會話的 refreshToken 和 sessionId
    const refreshTokenCookie = req.cookies.refreshToken;
    const currentSessionId = req.cookies.sessionId;

    try {
        // 刪除當前會話的 RefreshToken 記錄
        await RefreshToken.deleteOne({
            user: req.user._id,
            refreshToken: refreshTokenCookie,
            sessionId: currentSessionId
        });

        // 清除客戶端所有相關 Cookie
        resp.clearCookie('refreshToken');
        // resp.clearCookie('sessionId');
        resp.clearCookie('X-CSRF-Token');

        return resp.status(200).json({ message: 'Logged out successfully.' });
    } catch (error) {
        console.error("Error during logout:", error);
        return resp.status(500).json({ message: "Logout failed." });
    }
});
//--------------------------------------------------------------------------------------------------//

module.exports = logout;
