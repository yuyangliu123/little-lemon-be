const jwt = require('jsonwebtoken');
const jwtDecode = require('jwt-decode');
const { RefreshToken } = require('../model/models');
const createJwtToken = require('../utils/createJwtToken');

const refreshTokens = async (req, resp, next) => {
    if (req.tokenExpired) {
        const refreshTokenCookie = req.cookies.refreshToken;
        try {
            const refreshTokenDoc = await RefreshToken.findOne({ refreshToken: refreshTokenCookie });
            if (!refreshTokenDoc) {
                return resp.status(401).json('Invalid Refresh Token');
            }

            const decoded = jwt.verify(refreshTokenCookie, process.env.SECRET_KEY);
            const { email, fname, lname } = decoded;

            const newAccessToken = createJwtToken(fname, lname, email, '10s');
            const newRefreshToken = createJwtToken(fname, lname, email, '1d');

            refreshTokenDoc.accessToken = newAccessToken;
            refreshTokenDoc.refreshToken = newRefreshToken;
            await refreshTokenDoc.save();

            resp.cookie('refreshToken', newRefreshToken, { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'Lax' });

            // 在請求對象中設置新的 access token 以供後續中間件或路由處理器使用
            req.newAccessToken = newAccessToken;
        } catch (refreshError) {
            return resp.status(401).json('Refresh Token expired');
        }
    }
    next();
};

module.exports = refreshTokens;
