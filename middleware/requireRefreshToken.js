// middlewares/requireRefreshToken.js (或其他命名，專用於 refreshToken 路由)
const jwt = require('jsonwebtoken');
const { User, RefreshToken } = require('../model/models'); // 確保引入正確模型

const requireRefreshToken = async (req, resp, next) => {
    const oldRefreshToken = req.cookies.refreshToken;
    const currentSessionId = req.cookies.sessionId;
console.log(req.cookies,"req.cookies");

    // if (!oldRefreshToken || !currentSessionId) {
    //     // 清除前端可能的殘餘 Cookie
    //     resp.clearCookie('refreshToken');
    //     resp.clearCookie('sessionId');
    //     return resp.status(401).json({ message: 'Missing refresh token or session ID. Please login again.' });
    // }

    try {
        const secretKey = process.env.SECRET_KEY;
        let decodedRT;
        try {
            decodedRT = jwt.verify(oldRefreshToken, secretKey); // 驗證舊 RT 的簽名和過期時間
        } catch (jwtError) {
            // RT JWT 本身無效（簽名錯誤或格式錯誤），強制登出所有會話
            console.error("Invalid Refresh Token JWT:", jwtError.message);
            const userEmail = extractEmailFromToken(oldRefreshToken); // 從無效 RT 中提取 email
            if (userEmail) {
                const user = await User.findOne({ email: userEmail });
                if (user) await RefreshToken.deleteMany({ user: user._id }); // 清除所有該用戶的 RT
            }
            resp.clearCookie('refreshToken');
            // resp.clearCookie('sessionId');
            return resp.status(401).json({ message: "Invalid refresh token. Please login again.",jwtError });
        }

        // 查找資料庫中匹配的 Refresh Token 記錄 (確保是當前會話的有效 RT)
        // 使用 user 字段的 ObjectId 進行查詢，更穩健
        const user = await User.findOne({ email: decodedRT.email });
        if (!user) {
             console.warn(`User ${decodedRT.email} not found during refresh attempt.`);
             resp.clearCookie('refreshToken');
            //  resp.clearCookie('sessionId');
             return resp.status(401).json({ message: "User not found. Please login again." });
        }

        const tokenRecord = await RefreshToken.findOne({
            refreshToken: oldRefreshToken,
            sessionId: currentSessionId,
            user: user._id // 必須匹配 user_id
        });

        if (!tokenRecord) {
            // Refresh Token 重複使用偵測 或 該 RT 已被手動登出
            console.warn(`Detected possible refresh token replay attack or invalid session for user ${decodedRT.email} and session ${currentSessionId}. Revoking all tokens for this user.`);
            // await RefreshToken.deleteMany({ user: user._id }); // 清除所有該用戶的 RT
            resp.clearCookie('refreshToken');
            // resp.clearCookie('sessionId');
            return resp.status(401).json({ message: "Compromised session detected. Please login again." });
        }

        // 確保 RT 未過期 (即使 Schema 已設定 expires，這裡可做額外應用層判斷)
        if (tokenRecord.createdAt.getTime() + (30 * 24 * 60 * 60 * 1000) < Date.now()) { // 30d
            await RefreshToken.deleteOne({ _id: tokenRecord._id }); // 清除過期記錄
            resp.clearCookie('refreshToken');
            // resp.clearCookie('sessionId');
            return resp.status(401).json({ message: "Refresh token expired. Please login again." });
        }

        // 如果一切驗證通過，將 tokenRecord 和 user 附加到 req，供後續路由使用
        req.tokenRecord = tokenRecord;
        req.user = user;
        next();

    } catch (error) {
        console.error("Error in requireRefreshToken middleware:", error);
        resp.clearCookie('refreshToken');
        // resp.clearCookie('sessionId');
        return resp.status(500).json({ message: "Internal server error during token validation." });
    }
};

// 輔助函數 (可以在文件頂部定義，或單獨文件引入)
const extractEmailFromToken = (token) => {
    try {
        const payload = jwt.decode(token);
        return payload?.email || null;
    } catch (e) {
        return null;
    }
};

module.exports = requireRefreshToken;