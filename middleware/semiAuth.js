// middlewares/authenticateAccessToken.js
const jwt = require('jsonwebtoken');
const { User } = require('../model/models'); // 假設 User 模型

const semiAuth = async (req, resp, next) => {
    const authHeader = req.headers['authorization'];
    const accessToken = authHeader && authHeader.split(' ')[1];
    const sessionId = req.cookies.sessionId;

    console.log("semiAuth trigger", accessToken, sessionId,authHeader,!accessToken, "semiAuth trigger end");

    if (!sessionId) {
        resp.clearCookie('refreshToken');
        // resp.clearCookie('sessionId');
        return resp.status(401).json({ message: 'Access Token missing.' });
    }
    if (accessToken) {
        try {
            const secretKey = process.env.SECRET_KEY;
            const decoded = jwt.verify(accessToken, secretKey); // 驗證 AT 簽名和過期時間
            // 成功驗證 Access Token，將用戶資訊附加到 req
            req.user = await User.findOne({ email: decoded.email }); // 假設 AT payload 中有 userId
            if (!req.user) {
                return resp.status(401).json({ message: 'User not found for this Access Token.' });
            }
            next();

        } catch (e) {
            // Access Token 無效或過期
            console.log("semiauth error occur");

            if (e.name === 'TokenExpiredError') {
                // Access Token 過期了，但 Refresh Token 可能還有效。
                // 不在這裡直接發送 401，而是讓後續的刷新邏輯來處理。
                // 可以在 req 中標記 Access Token 已過期，讓路由決定如何處理
                req.accessTokenExpired = true;
                req.userEmail = e.expiredAt.email; // 從過期 Token 中提取 email

                req.sessionId = sessionId; // 確保有 sessionId
                return next(); // 允許請求繼續，交由路由處理刷新
            } else {
                // 其他 JWT 驗證錯誤 (例如簽名無效)
                resp.clearCookie('refreshToken');
                // resp.clearCookie('sessionId');
                console.error(`Invalid Access Token: ${e.message}`);
                return resp.status(401).json({ message: 'Invalid Access Token.' });
            }
        }
    } else {
        req.sessionId = sessionId; // 確保有 sessionId
        return next(); // 成功驗證並設置 req.user
    }

};

module.exports = semiAuth;