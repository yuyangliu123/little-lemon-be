const getInitialUserInfo = (req, res) => {
    let identifier;
    let isEmail = false;
console.log("getInitialUserInfo req start","seperate ..........................",req.user,"getInitialUserInfo req");

    if (!(req.user && req.user.email) && !req.sessionId) {
        console.warn('Authentication failed: User not authenticated or session ID missing');
        return res.status(401).json('User not authenticated or session ID missing');
    }
    if (req.user && req.user.email) {
        identifier = req.user.email;
        isEmail = true;
        return { identifier, isEmail }
    } else if (!(req.user && req.user.email) && req.sessionId) {
        identifier = req.sessionId;
        isEmail = false;
        return { identifier, isEmail }
    }
}
module.exports = { getInitialUserInfo }
