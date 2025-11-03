const jwt = require('jsonwebtoken');
const { User, RefreshToken } = require('../model/models');

const authenticate = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const accessToken = authHeader && authHeader.split(' ')[1];
    const refreshTokenCookie = req.cookies.refreshToken;
    const sessionId = req.cookies.sessionId; // 從 Cookie 讀取 sessionId（僅供購物車合併用）
    console.log("auth start", accessToken, refreshTokenCookie, sessionId, "auth end");

    // // 1. 優先處理 Access Token + Refresh Token（登錄狀態）
    // if (accessToken && refreshTokenCookie) {
    //     try {
    //         const secretKey = process.env.SECRET_KEY;
    //         const decoded = jwt.verify(accessToken, secretKey);
    //         const email = decoded.email;

    //         // 檢查 CSRF Token（僅在登錄狀態下強制驗證）
    //         const csrfHeader = req.headers["x-csrf-token"];
    //         const csrfToken = req.cookies["X-CSRF-Token"];
    //         if (!csrfHeader || !csrfToken || csrfHeader !== csrfToken) {
    //             await RefreshToken.deleteMany({ email });
    //             return resp.status(401).json('CSRF Token missing or mismatch');
    //         }

    //         // 驗證用戶和 Refresh Token
    //         const [user, refreshTokenDoc] = await Promise.all([
    //             User.findOne({ email }),
    //             RefreshToken.findOne({ email })
    //         ]);

    //         if (!user) {
    //             await RefreshToken.deleteMany({ email });
    //             return resp.status(401).json('User does not exist');
    //         }

    //         if (!refreshTokenDoc ||
    //             refreshTokenDoc.refreshToken !== refreshTokenCookie) {
    //             await RefreshToken.deleteMany({ email });
    //             return resp.status(401).json('Invalid access or refresh token');
    //         }

    //         // 登錄成功：附加 user 到 req
    //         req.user = user;
    //         req.sessionId = sessionId; // 仍然保留 sessionId（供購物車合併用）
    //         return next();

    //     } catch (e) {
    //         // Token 過期或其他錯誤處理
    //         if (e.name === 'TokenExpiredError') {
    //             const emailFromExpiredToken = extractEmailFromToken(accessToken);
    //             if (emailFromExpiredToken) {
    //                 req.user = { email: emailFromExpiredToken }; // 附加過期 token 的 email
    //                 req.sessionId = sessionId; // 保留 sessionId
    //             }
    //             return next(); // 繼續執行後續中間件（由路由決定是否刷新 token）
    //         } else {
    //             console.error(`Authentication error: ${e.message}`);
    //             await RefreshToken.deleteMany({ email: extractEmailFromToken(accessToken) });
    //             resp.clearCookie("refreshToken");
    //             return resp.status(401).json('Invalid Access Token');
    //         }
    //     }
    // }
    if (accessToken && refreshTokenCookie) {
        console.log("authenticate at rt trigger");

        try {
            const secretKey = process.env.SECRET_KEY;
            const decoded = jwt.verify(accessToken, secretKey); // 驗證 AT 簽名和過期時間
            // 成功驗證 Access Token，將用戶資訊附加到 req
            req.user = await User.findOne({ email: decoded.email }); // 假設 AT payload 中有 userId
            if (!req.user) {
                console.log("not user and return res");

                return res.status(401).json({ message: 'User not found for this Access Token.' });
            }
            next();

        } catch (e) {
            // Access Token 無效或過期
            if (e.name === 'TokenExpiredError') {
                // Access Token 過期了，但 Refresh Token 可能還有效。
                // 不在這裡直接發送 401，而是讓後續的刷新邏輯來處理。
                // 可以在 req 中標記 Access Token 已過期，讓路由決定如何處理
                req.accessTokenExpired = true;
                req.userEmail = e.expiredAt.email; // 從過期 Token 中提取 email
                return next(); // 允許請求繼續，交由路由處理刷新
            } else {
                // 其他 JWT 驗證錯誤 (例如簽名無效)
                res.clearCookie('refreshToken');
                // res.clearCookie('sessionId');
                console.error(`Invalid Access Tokensssss: ${e.message}`);
                return res.status(401).json({ message: 'Invalid Access Token.' });
            }
        }
    }
    // 2. 未登錄狀態：僅附加 sessionId（不驗證）
    req.sessionId = sessionId; // 無論是否登錄，都保留 sessionId
    next();
};

// 輔助函數：從 token 提取 email（不驗證簽名）
const extractEmailFromToken = (token) => {
    if (!token) return null;
    try {
        const payload = jwt.decode(token);
        return payload?.email || null;
    } catch (e) {
        return null;
    }
};

module.exports = authenticate;