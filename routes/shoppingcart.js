const mongoose = require('./db');

//--------------------------------------------------------------------------------------------------//
// For backend and express
const express = require('express');
const cookieParser = require('cookie-parser');

const https = require("https")
const fs = require("fs")
const shoppingcart = express();
const cors = require("cors");
const { User, RefreshToken, Meal, ShoppingCart } = require('../model/models');
const { jwtDecode } = require('jwt-decode');

const { string } = require('yup');
const redis = require('redis');
const { promisify } = require('util');
const { log } = require('console');
const { updateCartState } = require('../utils/updateCartState');
const { getInitialUserInfo } = require('../utils/getInitialUserInfo');
const { findInitialShoppingCart } = require('../utils/findInitialShoppingCart');
const { unAuthMergeCart } = require('../utils/unAuthMergeCart');

// 创建Redis客户端
const redisClient = redis.createClient({
	host: process.env.REDIS_HOST || 'localhost',
	port: process.env.REDIS_PORT || 6379,
});

redisClient.connect();
// 添加连接事件监听
redisClient.on('connect', () => {
	console.log('Redis client connected');
});

redisClient.on('error', (err) => {
	console.error('Redis client error:', err);
});

redisClient.on('end', () => {
	console.log('Redis client disconnected');
});
// 将Redis命令转换为Promise形式
const getAsync = redisClient.get.bind(redisClient);
const setAsync = redisClient.set.bind(redisClient);
const delAsync = redisClient.del.bind(redisClient);
console.log("App listen at port 5000");
//set sign of cookie

shoppingcart.use(express.json());
shoppingcart.use(cookieParser())
const corsOptions = {
	origin: 'http://localhost:3000', // Change to frontend's URL
	credentials: true, // Allow credentials (cookies, authorization headers, etc.)
};
shoppingcart.use(cors(corsOptions));
shoppingcart.get("/", (req, resp) => {

	resp.send("App is Working");
	// Can check backend is working or not by
	// entering http://localhost:5000
	// If you see App is working means
	// backend working properly
});
//--------------------------------------------------------------------------------------------------//


shoppingcart.post("/addToCart", async (req, res) => {
	// const accessToken = req.headers['authorization'].split(' ')[1];
	// const email = jwtDecode(accessToken)?.email
	// // Check if there is cart data in the database
	// let shoppingcart = await ShoppingCart.findOne({ email: email });
	const { identifier, isEmail } = await getInitialUserInfo(req)

	let shoppingcart = await findInitialShoppingCart(identifier, isEmail);
	let mealItem = await Meal.findOne({ idMeal: req.body.idMeal });
	if (!mealItem) {
		return res.status(400).send({ error: "Meal item not found" });
	}

	let price = mealItem.price;
	if (typeof price !== 'number' || isNaN(price)) {
		return res.status(400).send({ error: "Invalid meal price" });
	}

	if (shoppingcart) {
		// If the user already has a shopping cart, find the meal
		let cartItem = shoppingcart.data.find(item => item.idMeal === req.body.idMeal);
		if (cartItem) {
			// If the meal already exists in the shopping cart, update numMeal and cartAmount
			cartItem.numMeal += req.body.numMeal;
			cartItem.cartAmount = Number((cartItem.numMeal * cartItem.baseAmount).toFixed(2));
		} else {
			// If the meal doesn't exist in the shopping cart, add it to database
			shoppingcart.data.push({
				// strMeal: req.body.meal,
				numMeal: req.body.numMeal,
				idMeal: req.body.idMeal,
				// baseAmount: price,
				// cartAmount: Number((req.body.numMeal * price).toFixed(2)),
				// strMealThumb: req.body.strMealThumb,
			});
		}
	} else {
		// If the user doesn't have a shopping cart, create a new one
		const cartData = {
			[isEmail ? 'email' : 'sessionId']: identifier,
			totalAmount: Number((req.body.numMeal * price).toFixed(2)),
			totalItem: req.body.numMeal,
			data: [{
				strMeal: req.body.meal,
				numMeal: req.body.numMeal,
				idMeal: req.body.idMeal,
				baseAmount: price,
				cartAmount: Number((req.body.numMeal * price).toFixed(2)),
				strMealThumb: req.body.strMealThumb,
			}]
		};

		shoppingcart = new ShoppingCart(cartData);
	}

	// Calculate totalAmount
	shoppingcart.totalAmount = shoppingcart.data.reduce((sum, item) => sum + item.cartAmount, 0);
	shoppingcart.totalAmount = Number(shoppingcart.totalAmount.toFixed(2));
	// const checkedItem = shoppingcart.data.filter(item => item.checked === true)
	// shoppingcart.checkeditem = Number(checkedItem)
	// shoppingcart.checkedAmount = Number(checkedItem.reduce((sum, item) => sum + item.cartAmount, 0).toFixed(2))
	// Calculate totalItem
	shoppingcart.totalItem = shoppingcart.data.reduce((sum, item) => sum + item.numMeal, 0);
	// Asynchronously save the shopping cart to the database.
	let result = await shoppingcart.save();
	// Convert the Mongoose document object to a plain JavaScript object.
	result = result.toObject();
	// Send the request body back as a response.
	res.status(200).send(result);
	// Log the saved user object to the server's console.
	console.log(result);
});

shoppingcart.post("/updateCart", async (req, res) => {
	try {
		const { identifier, isEmail } = await getInitialUserInfo(req)

		const { updatedItems } = req.body;
		if (!updatedItems || !Array.isArray(updatedItems)) {
			return res.status(400).send({ status: "error", message: "Invalid request body" });
		}

		const result = await updateCartState(identifier, isEmail, updatedItems);
		console.log(result, "result");
		setTimeout(() => {
			if (req.aborted || res.writableEnded) {

				console.log('請求已被前端取消，放棄回應', req.aborted, res.writableEnded);
				return;
			}
		}, 6000);
		// res.status(200).json({ message: "成功" });
		res.status(200).send({ status: "ok", result: result })
	} catch (error) {
		console.error("Error:", error);
		res.status(500).send({ status: "error", message: error.message });
	}
});

shoppingcart.post("/mergeCart", async (req, res) => {
	try {
		const { identifier, isEmail } = await getInitialUserInfo(req)
		// 1. 驗證授權和請求參數
		const authHeader = req.headers['authorization'];
		if (!authHeader) return res.status(401).send({ status: "error", message: "Authorization header missing" });

		const sessionId = req.cookies.sessionId
		const result = await unAuthMergeCart(identifier, isEmail, sessionId);
		setTimeout(() => {
			if (req.aborted || res.writableEnded) {

				console.log('請求已被前端取消，放棄回應', req.aborted, res.writableEnded);
				return;
			}
		}, 6000);
		// res.status(200).json({ message: "成功" });
		res.status(200).send({ status: "ok", result: result })
	} catch (error) {
		console.error("Error:", error);
		res.status(500).send({ status: "error", message: error.message });
	}
});

shoppingcart.post("/like", async (req, res) => {

	const { identifier, isEmail } = await getInitialUserInfo(req)

	let shoppingcart = await findInitialShoppingCart(identifier, isEmail);

	if (req.body.event === "like") {
		if (shoppingcart) {
			if (req.body.likeState === "like") {
				shoppingcart.likeItem.push({
					idMeal: req.body.idMeal,
				});
			} else if (req.body.likeState === "none") {
				shoppingcart.likeItem = shoppingcart.likeItem.filter(item => item.idMeal !== req.body.idMeal);
				if ((shoppingcart.data.length === 0) && (shoppingcart.likeItem.length === 0)) {
					// If shoppingcart.data is empty, delete the shopping cart
					// if (isEmail) {
					// 	await ShoppingCart.deleteOne({ email: identifier });
					// } else {
					// 	await ShoppingCart.deleteOne({ sessionId: identifier });
					// }
					await deleteShoppingCart(identifier, isEmail)
					res.status(201).send({ status: "delete" });
					return
				}
			}
		} else {
			// If the user doesn't have a shopping cart, create a new one
			const cartData = {
				[isEmail ? 'email' : 'sessionId']: identifier,
				totalAmount: 0,
				totalItem: 0,
				likeItem: [{ idMeal: req.body.idMeal }]
			};

			shoppingcart = new ShoppingCart(cartData);
		}
		// Save the changes to the database
		let savedCart = await shoppingcart.save();
		res.status(200).send({ status: "ok", shoppingcart: savedCart });
	}
}
);

module.exports = shoppingcart;

