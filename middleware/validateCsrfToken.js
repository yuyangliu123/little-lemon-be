// middlewares/validateCsrfToken.js
const validateCsrfToken = (req, resp, next) => {
    const csrfHeader = req.headers["x-csrf-token"];
    const csrfCookie = req.cookies["X-CSRF-Token"];

    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
        // CSRF Token 不匹配，通常不會清空所有 RT，因為這不一定是會話被入侵
        // 而是可能的 CSRF 攻擊嘗試，直接拒絕請求即可
        return resp.status(403).json({ message: 'CSRF Token mismatch or missing.' });
    }
    next();
};

module.exports = validateCsrfToken;