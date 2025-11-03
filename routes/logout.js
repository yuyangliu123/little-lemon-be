//--------------------------------------------------------------------------------------------------//
// For backend and express
const express = require('express');

const cookieParser = require('cookie-parser');
const mongoose = require('./db');
const { RefreshToken } = require('../model/models');
const logout = express();
const cors = require("cors");
console.log("App listen at port 5000");
const { jwtDecode } = require('jwt-decode');
const authenticateAccessToken = require('../middleware/authenticateAccessToken');

logout.use(express.json());
logout.use(cors());
//set sign of cookie
logout.use(cookieParser())
const corsOptions = {
	origin: 'http://localhost:3000', // Change to frontend's URL
	credentials: true, // Allow credentials (cookies, authorization headers, etc.)
};
logout.use(cors(corsOptions));
logout.get("/", (req, resp) => {

	resp.send("App is Working");
	// Can check backend is working or not by
	// entering http://localhost:5000
	// If you see App is working means
	// backend working properly
});

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
