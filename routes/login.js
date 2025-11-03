
// To connect with mongoDB database
const mongoose = require('./db');

// For backend and express
const express = require('express');
const cookieParser = require('cookie-parser');
const login = express();
const cors = require("cors");
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const { v4: uuidv4 } = require('uuid');
require("dotenv").config()
const SECRET_KEY = process.env.SECRET_KEY;
const { string } = require('yup');
const { jwtDecode } = require('jwt-decode');
const { RefreshToken, User } = require('../model/models');
const requireRefreshToken = require('../middleware/requireRefreshToken');

console.log("App listen at port 5000");
login.use(express.json());

//set sign of cookie
login.use(cookieParser())
const corsOptions = {
    origin: 'http://localhost:3000', // Change to frontend's URL
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
};
login.use(cors(corsOptions));
login.get("/", (req, resp) => {

    resp.send("App is Working");
    // Can check backend is working or not by
    // entering http://localhost:5000
    // If you see App is working means
    // backend working properly
});

const createJwtToken = (fname, lname, email, _id, expiresIn) => {
    const payload = {
        fname: fname,
        lname: lname,
        email: email,
        _id: _id,
    };
    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: expiresIn });
    return token;
};

// This route handler processes user login requests for the '/login' path.
login.post("/login", async (req, resp) => {
    const { email, password } = req.body;
    try {
        // Find a user instance with the email from the request body.
        const user = await User.findOne({ email: email });
        if (user) {

            // Check if the password matches.
            const validPassword = await bcrypt.compare(password, user.password);
            if (validPassword) {
                // Create a JWT token with a longer expiration (1 days)
                const accessToken = createJwtToken(user.fname, user.lname, email, user._id, "10s");
                const refreshToken = createJwtToken(user.fname, user.lname, email, user._id, "1d");
                const sessionId = req.cookies.sessionId
                // Assume that if the user manually deletes the rt (refresh token), then after a normal login,
                // it will directly update the rt part. Otherwise, it will create a new database
                // const sameUser = await RefreshToken.findOne({ email: email })
                // if (sameUser) {
                //     await RefreshToken.findOneAndUpdate({ email: email }, { user: user._id, refreshToken: refreshToken })
                // } else {

                // 準備要儲存或更新的資料
                const tokenData = {
                    user: user._id,
                    email: user.email,
                    refreshToken: refreshToken,
                    sessionId: sessionId,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    lastUsedAt: Date.now()
                };

                // 使用 findOneAndUpdate 搭配 upsert: true 來簡化邏輯
                // 如果找到 sessionId 匹配的記錄，則更新它；如果沒有找到，則創建一個新的
                const updatedOrNewToken = await RefreshToken.findOneAndUpdate(
                    { sessionId: sessionId }, // 查詢條件
                    tokenData, // 更新或插入的資料
                    {
                        new: true, // 返回更新後的文檔 (如果執行了更新) 或新創建的文檔 (如果執行了插入)
                        upsert: true, // 如果找不到匹配的文檔，則創建一個新的
                        setDefaultsOnInsert: true // 對於新創建的文檔，如果模型有預設值，則應用它們
                    }
                );

                // 判斷是更新還是創建 (可以透過 updatedOrNewToken 來判斷，但這裡簡單用 console.log 示意)
                if (updatedOrNewToken._id) { // 通常新建立的文檔會有 _id
                    console.log(`RefreshToken ${updatedOrNewToken.isNew ? '已創建' : '已更新'}。`);
                }
                let result = updatedOrNewToken.toObject();
                if (result.user && result.user.password) {
                    delete result.user.password;
                }
                // }
                // Set HTTP-only cookies for the access and refresh tokens
                // This cookies are sent to the client and used for authentication in future requests
                // resp.cookie('sessionId', sessionId, { maxAge: 24 * 60 * 60 * 1000, httpOnly: false, secure: true, sameSite: 'Lax' });
                resp.cookie('refreshToken', refreshToken, { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'Lax' });
                resp.status(200).send({ state: true, name: user.fname, accessToken });
            } else {
                // If the password does not match, send an error message.
                resp.status(400).send("Invalid password");
            }
        } else {
            // If the user does not exist, send an error message.
            resp.status(400).send("User does not exist");
        }
    } catch (e) {
        resp.status(400).send(`Something Went Wrong, ${e}`);
    }
});

// This route handler processes user login requests for the '/login' path.

//here
login.post('/check-refresh-token', requireRefreshToken, async (req, resp) => {

    const { user, tokenRecord } = req; // 從 req 獲取用戶和舊的 RefreshToken 記錄

    try {
        await RefreshToken.deleteOne({ _id: tokenRecord._id });

        const newAccessToken = createJwtToken(user.fname, user.lname, user.email, user._id, '10s');
        const newRefreshToken = createJwtToken(user.fname, user.lname, user.email, user._id, '1d');

        const newRecord = new RefreshToken({
            user: user._id,
            refreshToken: newRefreshToken,
            sessionId: tokenRecord.sessionId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            lastUsedAt: Date.now()
        });
        await newRecord.save();


        resp.cookie('refreshToken', newRefreshToken, { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'Lax' });

        return resp.status(200).json({ accessToken: newAccessToken });

    } catch (error) {
        console.error("Error during token refresh:", error);
        resp.clearCookie('refreshToken');
        // resp.clearCookie('sessionId');
        resp.clearCookie('X-CSRF-Token');
        return resp.status(500).json({ message: "Token refresh failed. Please login again.", error });
    }
});



module.exports = login;
