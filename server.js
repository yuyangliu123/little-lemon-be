// server.js
const express = require('express');
const helmet = require('helmet');
const cors = require("cors");
const corsOptions = {
    origin: 'http://localhost:3000', // Change to your frontend's URL
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
};

const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid'); // 引入 uuid
const { ApolloServer } = require('apollo-server-express');
const { resolvers } = require("./apolloGQL/resolvers");
const { typeDefs } = require("./apolloGQL/models/typeDefs");

const reservationRouter = require("./routes/reservation")
const signupRouter = require("./routes/signup")
const loginRouter = require("./routes/login")
const logoutRouter = require("./routes/logout")
const forgotpasswordRouter = require("./routes/forgotpassword")
// const authRouter = require("./routes/auth")
const apiRouter = require("./routes/api")
const shoppingcartRouter = require("./routes/shoppingcart")
const session = require('express-session');
const imgConverterRouter = require("./routes/imgConverter")
const checkoutRouter = require("./routes/checkout")
// --- 引入拆分後的驗證 Middleware ---
const authenticateAccessToken = require('./middleware/authenticateAccessToken'); // 確保路徑正確
const validateCsrfToken = require('./middleware/validateCsrfToken');       // 確保路徑正確
// const requireRefreshToken = require('./middleware/requireRefreshToken');   // 專用於 Refresh Token 路由
const apolloPublicOperations = require('./config/apolloPublicOperations');
const semiAuth = require('./middleware/semiAuth');
const apolloSemiPublicOperations = require('./config/apolloSemiPublicOperations');
const apolloPrivateOperations = require('./config/apolloPrivateOperations');
const app = express();
app.use(cors(corsOptions));
//set sign of cookie
app.use(cookieParser());

app.get("/init", async (req, res) => {
    try {
        if (!req.cookies || !req.cookies.sessionId) {
            // 如果不存在，生成一個新的 sessionId
            const newSessionId = uuidv4();
            // 將新的 sessionId 設置為 cookie
            // 注意：這裡的 maxAge 設置為 1 天，您可以根據需求調整
            // httpOnly: false 是為了讓前端 JavaScript 可以訪問這個 cookie (如果您有此需求)
            // secure: true 建議在生產環境中啟用，確保只通過 HTTPS 發送
            // sameSite: 'Lax' 是為了 CSRF 保護
            res.cookie('sessionId', newSessionId, {
                maxAge: 24 * 60 * 60 * 1000, // 1 天的有效期
                httpOnly: false, // 如果您需要前端JS讀取，設置為 false；否則建議設置為 true 以增強安全性
                secure: process.env.NODE_ENV === 'production', // 生產環境中應為 true
                sameSite: 'Lax'
            });
            console.log(`為新訪客設置 sessionId: ${newSessionId}`);

        } else {
            console.log(`init 現有 sessionId: ${req.cookies.sessionId}`);
        }
        return res.status(200).json("ok");
    } catch (e) {
        console.log(e, "e");
        return res.status(401).json("something went wrong:", e);
    }

})

// --- 基本 Middleware 設定  ---
//remove x-powered-by header
app.use((req, res, next) => {
    const send = res.send;
    res.send = (data) => {
        res.removeHeader('X-Powered-By');
        return send.call(res, data);
    };

    next();
});
app.use(helmet());
app.use(express.json());



app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    //the cookie will only be sent over HTTPS connection
    cookie: { secure: true }
}))


app.use((req, res, next) => {
    // 檢查請求中是否已經存在 sessionId 的 cookie
    if (!req.cookies.sessionId) {
        // 如果不存在，生成一個新的 sessionId
        const newSessionId = uuidv4();
        // 將新的 sessionId 設置為 cookie
        // 注意：這裡的 maxAge 設置為 1 天，您可以根據需求調整
        // httpOnly: false 是為了讓前端 JavaScript 可以訪問這個 cookie (如果您有此需求)
        // secure: true 建議在生產環境中啟用，確保只通過 HTTPS 發送
        // sameSite: 'Lax' 是為了 CSRF 保護
        res.cookie('sessionId', newSessionId, {
            maxAge: 24 * 60 * 60 * 1000, // 1 天的有效期
            httpOnly: false, // 如果您需要前端JS讀取，設置為 false；否則建議設置為 true 以增強安全性
            secure: process.env.NODE_ENV === 'production', // 生產環境中應為 true
            sameSite: 'Lax'
        });
        req.cookies.sessionId=newSessionId
        console.log(`app 為新訪客設置 sessionId: ${newSessionId}`);
    } else {
        console.log(`app 現有 sessionId: ${req.cookies.sessionId}`);
    }
    // 繼續處理下一個中間件或路由
    next();
});

// --- 集中管理認證和 CSRF Middleware ---


// 定義不需要身份驗證或 CSRF 驗證的公共路由或特殊路由
const publicRoutes = [
    '/signup',
    '/login', // 登入路由，它自己處理認證
    '/forgotpassword',
    "/api", //here should split addtocart from /api router
    "/img",
];

const semiPublicRoutes = [
    "/reservation",
    "/shoppingcart",
]

const privateRoutes = [
    '/logout',
    "/checkout",
]
////////////////////here  驗證authenticateAccessToken會產生req.user =>得到req.user.email 但如果不驗證則沒有 =而/shoppingcart又是公共router
// 對所有非公共路由應用 authenticateAccessToken
// 它會驗證 Access Token 並將用戶資訊附加到 req.user
app.use((req, res, next) => {
    // 檢查請求路徑是否在公共路由列表中
    const isPublicRoute = publicRoutes.some(route => req.path.startsWith(route));
    const isSemiPublicRoute = semiPublicRoutes.some(route => req.path.startsWith(route))
    const isPrivateRoute = privateRoutes.some(route => req.path.startsWith(route))

    // 排除 GraphQL 路由和公共路由
    if (req.path === '/graphql' || isPublicRoute) {
        return next();
    }
    if (isSemiPublicRoute) {
        console.log("semi authenticate trigger");
        semiAuth(req, res, next);
    }
    // 對其他所有路由應用 Access Token 驗證
    if (req.path !== '/graphql' && !isPublicRoute && !isSemiPublicRoute || isPrivateRoute) {
        authenticateAccessToken(req, res, next);
    }
});

// 對所有非公共路由，且已通過 Access Token 驗證的請求，應用 CSRF 驗證
app.use((req, res, next) => {
    // 再次檢查是否為公共路由或 GraphQL 路由
    const isPublicRoute = publicRoutes.some(route => req.path.startsWith(route));
    if (req.path === '/graphql' || isPublicRoute) {
        return next();
    }

    // 只有當用戶已驗證 (req.user 存在) 且 Access Token 未過期時才進行 CSRF 驗證
    // 如果 Access Token 過期 (req.accessTokenExpired)，通常也不需要檢查 CSRF，因為會觸發刷新
    if (req.user && !req.accessTokenExpired) {
        validateCsrfToken(req, res, next);
    } else {
        next(); // 如果沒有登錄或 AT 已過期，則跳過 CSRF 驗證
    }
});


// --- 路由定義 (保持不變，但移除它們內部重複的 middleware) ---
app.use("/reservation", reservationRouter);
app.use('/signup', signupRouter);
app.use('/login', loginRouter);
app.use('/logout', logoutRouter);
app.use('/forgotpassword', forgotpasswordRouter);
// app.use("/auth", authRouter)
app.use("/api", apiRouter);
app.use("/shoppingcart", shoppingcartRouter);
app.use("/img", imgConverterRouter)
app.use("/checkout", checkoutRouter)











//Apollo Server
const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req, res }) => {
        // 在這裡，你可以繼續保持 GraphQL 特有的驗證邏輯
        // 或者，如果你在 Express 層已經統一處理了，這裡可以更簡潔
        // 建議在 context 中也使用 authenticateAccessToken，並讓它設置 req.user 和 req.accessTokenExpired
        // CSRF 可以在 Express 層統一處理，或在 Resolver 中處理特定 Mutation

        const isPublicOperation = apolloPublicOperations.includes(req.body.operationName);
        const isSemiPublicOperation = apolloSemiPublicOperations.includes(req.body.operationName)
       const isPrivateOperations=apolloPrivateOperations.includes(req.body.operationName)
        if (isSemiPublicOperation) {
            console.log("semi authenticate trigger");
            await new Promise((resolve) => {
                semiAuth(req, res, (err) => {
                    if (err) console.error('Error in context semiAuth:', err);
                    resolve();
                });
            });
        }
        if (!isPublicOperation && !isSemiPublicOperation||isPrivateOperations) {
            await new Promise((resolve) => {
                authenticateAccessToken(req, res, (err) => {
                    if (err) console.error('Error in context authenticateAccessToken:', err);
                    resolve();
                });
            });

            // CSRF 驗證可以統一在 Express 層處理，或者在 Resolver 中針對 Mutation 額外處理。
            // 如果在 Express 層已經處理了，這裡就不需要再處理 CSRF 了。
            // 如果你仍想在 GraphQL context 處理 CSRF for Mutations:
            // 如果是 mutation 操作，額外檢查 CSRF
            if (req.user && req.body.query && req.body.query.includes('mutation')) {
                await new Promise((resolve, reject) => {
                    validateCsrfToken(req, res, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                }).catch(err => {
                    throw new Error(`CSRF Token validation failed for mutation: ${err.message}`);
                });
            }
        }


        // 確保返回正確的上下文
        return { user: req.user, accessTokenExpired: req.accessTokenExpired };
    },
});
// const apolloServer = new ApolloServer({
//   typeDefs,
//   resolvers,
//   context: async ({ req, res }) => {
//     // use lightAuthenticate middleware for Query
//     if (req.body.operationName === 'IntrospectionQuery' || req.body.query.includes('query')) {
//       await new Promise((resolve, reject) => {
//         lightAuthenticate(req, res, (err) => {
//           if (err) reject(err);
//           else resolve();
//         });
//       });
//     }
//     // use authenticate middleware for Mutation
//     else if (req.body.query.includes('mutation')) {
//       await new Promise((resolve, reject) => {
//         authenticate(req, res, (err) => {
//           if (err) reject(err);
//           else resolve();
//         });
//       });
//     }

//     return { user: req.user };
//   },
// });



// start Apollo Server
apolloServer.start().then(() => {
    // connect Apollo Server with Express
    apolloServer.applyMiddleware({ app, cors: corsOptions });

    app.listen(5000, () => console.log(`🚀 Server ready at http://localhost:5000${apolloServer.graphqlPath}`));
});
