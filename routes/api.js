const mongoose = require('./db');

//--------------------------------------------------------------------------------------------------//
// For backend and express
const express = require('express');
const cookieParser = require('cookie-parser');

const https = require("https")
const fs = require("fs")
const api = express();
const cors = require("cors");
const { User, RefreshToken, Meal, ShoppingCart } = require('../model/models');
const { jwtDecode } = require('jwt-decode');

const { string } = require('yup');
const authenticate = require('../middleware/authenticate');
const redis = require('redis');
const { promisify } = require('util');
const { log } = require('console');
const { updateCartState } = require('../utils/updateCartState');
const { getInitialUserInfo } = require('../utils/getInitialUserInfo');
const { findInitialShoppingCart } = require('../utils/findInitialShoppingCart');
const { unAuthMergeCart } = require('../utils/unAuthMergeCart');
const semiAuth = require('../middleware/semiAuth');

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

api.use(express.json());
api.use(cookieParser())
const corsOptions = {
	origin: 'http://localhost:3000', // Change to frontend's URL
	credentials: true, // Allow credentials (cookies, authorization headers, etc.)
};
api.use(cors(corsOptions));
api.get("/", (req, resp) => {

	resp.send("App is Working");
	// Can check backend is working or not by
	// entering http://localhost:5000
	// If you see App is working means
	// backend working properly
});
//--------------------------------------------------------------------------------------------------//

//--------------------------------------------------------------------------------------------------//

api.get("/api", async (req, res) => {
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 20;
	const skip = (page - 1) * limit;
	const sort = req.query.sort || "default";

	// 1. 建立獨特的快取鍵
	const cacheKey = `meals:page:${page}:limit:${limit}:sort:${sort}`;

	try {
		// 2. 嘗試從 Redis 讀取快取
		const cachedData = await redisClient.get(cacheKey);
		if (cachedData) {
			console.log('Cache hit for /api');
			return res.status(201).json(JSON.parse(cachedData));
		}

		console.log('Cache miss for /api. Querying MongoDB...');

		let sortedData;
		switch (sort) {
			case 'asc':
				sortedData = await Meal.find().sort({ price: 1 }).skip(skip).limit(limit);
				break;
			case 'dsc':
				sortedData = await Meal.find().sort({ price: -1 }).skip(skip).limit(limit);
				break;
			default:
				sortedData = await Meal.find().skip(skip).limit(limit);
		}

		// 獲取類別資訊，這個部分也可以快取
		const category = await Meal.distinct("category");

		const result = { "category": category, "data": sortedData };

		// 3. 將資料寫入 Redis 快取，設定過期時間(TTL:60分鐘)
		await setAsync(cacheKey, JSON.stringify(result), { 'EX': 1800 });

		res.status(201).json(result);

	} catch (err) {
		console.error("Error: " + err.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
});


//--------------------------------------------------------------------------------------------------//

api.get('/order', async (req, res) => {
	const categoryId = req.query.category
	const sort = req.query.sort || "default"
	const cacheCategoryKey = `meal:category`
	const cacheSortKey = `meal:sort:${sort}`
	try {


		const cachedCategoryData = await getAsync(cacheCategoryKey)
		const cachedSortData = await getAsync(cacheSortKey)

		if (cachedCategoryData && cachedSortData) {
			console.log('Cache hit for /order');
			return res.status(200).json({ "category": JSON.parse(cachedCategoryData), "data": JSON.parse(cachedSortData) });
		}


		console.log('Cache miss for /order. Querying MongoDB...');
		let category = await Meal.distinct("category")
		await setAsync(cacheCategoryKey, JSON.stringify(category), { 'EX': 1800 })
		//sort by url
		let sortedData
		switch (sort) {
			case 'asc':
				sortedData = await Meal.find({ category: req.query.category }).sort({ price: 1 })
				break
			case 'dsc':
				sortedData = await Meal.find({ category: req.query.category }).sort({ price: -1 })
				break
			default:
				sortedData = await Meal.find({ category: req.query.category })
		}
		await setAsync(cacheSortKey, JSON.stringify(sortedData), { 'EX': 1800 })

		res.status(201).json({ "category": category, "data": sortedData });
	} catch (err) {
		console.log("Error: " + err.message);
	}
});

api.get("/search-suggestions", async (req, res) => {
	const searchString = req.query.query.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '');

	try {
		// 先搜尋以搜索字串開頭的結果
		const startWithSuggestions = await Meal.find({
			strMeal: { $regex: `^${searchString}`, $options: 'i' }
		}).limit(10);

		// 如果開頭搜尋結果不足10個，則補充包含搜索字串的結果
		let suggestions = startWithSuggestions;
		if (startWithSuggestions.length < 10) {
			const containSuggestions = await Meal.find({
				strMeal: {
					$regex: searchString,
					$options: 'i'
				},
				// 排除已經在startWithSuggestions中的結果
				_id: { $nin: startWithSuggestions.map(item => item._id) }
			}).limit(10 - startWithSuggestions.length);

			suggestions = [...startWithSuggestions, ...containSuggestions];
		}

		res.status(200).json(suggestions);
	} catch (error) {
		res.status(500).json({ message: "搜尋失敗", error: error.message });
	}
});

api.get("/search", async (req, res) => {
	const searchString = req.query.search.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '');
	const sort = req.query.sort || "default"
	let category = await Meal.distinct("category")

	try {
		// 搜索包含搜索字符串的所有文档
		const allResults = await Meal.find({ strMeal: { $regex: searchString, $options: 'i' } });


		let sortedResults
		switch (sort) {
			case 'asc':
				sortedResults = await Meal.find({ strMeal: { $regex: searchString, $options: 'i' } }).sort({ price: 1 })
				break
			case 'dsc':
				sortedResults = await Meal.find({ strMeal: { $regex: searchString, $options: 'i' } }).sort({ price: -1 })
				break
			default:
				sortedResults = allResults.sort((a, b) => {
					const indexA = a.strMeal.toLowerCase().indexOf(searchString);
					const indexB = b.strMeal.toLowerCase().indexOf(searchString);

					// 按照出现的位置升序排序
					return indexA - indexB;
				});
		}

		res.status(200).json({ "category": category, "data": sortedResults });
	} catch (error) {
		res.status(500).json({ message: "search fall", error: error.message })
	}
});


api.get("/foodPage/:idMeal", async (req, res) => {
	try {
		let mealData = await Meal.find({ idMeal: req.params.idMeal })
		res.status(200).json(mealData[0])
	} catch (err) {
		console.log("Error: " + err.message);
	}
})

api.post("/addToCart", authenticate, async (req, res) => {
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

// 新增API端点处理check state的變更，保存到Redis
//https://myapollo.com.tw/blog/interview-question-cache-patterns/

//使用write through策略
api.post("/updateCart", authenticate, async (req, res) => {
	try {
		const { identifier, isEmail } = await getInitialUserInfo(req)
		// 1. 驗證授權和請求參數
		const authHeader = req.headers['authorization'];
		if (!authHeader) return res.status(401).send({ status: "error", message: "Authorization header missing" });

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

// api.post("/mergeCart", authenticate, async (req, res) => {
// 	try {
// 		const { identifier, isEmail } = await getInitialUserInfo(req)
// 		// 1. 驗證授權和請求參數
// 		const authHeader = req.headers['authorization'];
// 		if (!authHeader) return res.status(401).send({ status: "error", message: "Authorization header missing" });

// 		const sessionId = req.cookies.sessionId
// 		//here/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 		// if (!updatedItems || !Array.isArray(updatedItems)) {
// 		// 	return res.status(400).send({ status: "error", message: "Invalid request body" });
// 		// }
// 		// console.log(userInfo, "userInfo");
// 		console.log(identifier, isEmail, sessionId, "identifier, isEmail,sessionId");

// 		const result = await unAuthMergeCart(identifier, isEmail, sessionId);
// 		console.log(result, "unAuthMergeCart");
// 		// setTimeout(() => {
// 		// 	if (req.aborted || res.writableEnded) {

// 		// 		console.log('請求已被前端取消，放棄回應', req.aborted, res.writableEnded);
// 		// 		return;
// 		// 	}
// 		// }, 6000);
// 		// res.status(200).json({ message: "成功" });
// 		return res.status(200).send({ status: "ok", result: result })
// 	} catch (error) {
// 		console.error("mergeCart Error :", error);
// 		return res.status(500).send({ status: "error", message: error.message });
// 	}
// });
api.post("/mergeCart", semiAuth, async (req, res) => {
	try {
		const { identifier, isEmail } = await getInitialUserInfo(req)
		// 1. 驗證授權和請求參數
		const authHeader = req.headers['authorization'];
		if (!authHeader) return res.status(401).send({ status: "error", message: "Authorization header missing" });

		const sessionId = req.cookies.sessionId
		//here/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
		// if (!updatedItems || !Array.isArray(updatedItems)) {
		// 	return res.status(400).send({ status: "error", message: "Invalid request body" });
		// }
		// console.log(userInfo, "userInfo");
		console.log(identifier, isEmail, sessionId, "identifier, isEmail,sessionId");

		const result = await unAuthMergeCart(identifier, isEmail, sessionId);
		console.log(result, "unAuthMergeCart");
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

api.post("/update", authenticate, async (req, res) => {
	// let identifier;
	// let isEmail = false;

	// if (req.user && req.user.email) {
	// 	identifier = req.user.email;
	// 	isEmail = true;
	// 	console.log("Using email:", identifier);
	// } else if (req.sessionId) {
	// 	identifier = req.sessionId;
	// 	isEmail = false;
	// 	console.log("Using session ID:", identifier);
	// } else {
	// 	// 這應該在中間件中被捕獲，但為了安全起見還是加上
	// 	return res.status(401).json('User not authenticated or session ID missing');
	// }
	const { identifier, isEmail } = await getInitialUserInfo(req)
	console.log(identifier, isEmail, "identifier,isEmail");

	// Check if there is cart data in the database
	// let shoppingcart;
	// if (isEmail) {
	// 	shoppingcart = await ShoppingCart.findOne({ email: identifier });
	// } else {
	// 	shoppingcart = await ShoppingCart.findOne({ sessionId: identifier });
	// }
	// console.log('Request body:', req.body); // Add this line to log the request body

	let shoppingcart = await findInitialShoppingCart(identifier, isEmail);
	console.log(shoppingcart, "shopping");


	if (req.body.event === "update") {
		if (shoppingcart) {
			// If the user has a shopping cart, find the meal
			let cartItem = shoppingcart.data.find(item => item.idMeal === req.body.updatedItems.idMeal)
			if (cartItem) {
				// If the number of meals in the request is <= 0 (through the close button or modifying the input number)
				if (req.body.updatedItems.numMeal <= 0) {
					// Filter out the item with numMeal > 0
					shoppingcart.data = shoppingcart.data.filter(item => item.idMeal !== req.body.updatedItems.idMeal);
				} else {
					// If the meal already exists in the shopping cart, update numMeal and cartAmount
					cartItem.numMeal = req.body.updatedItems.numMeal;
					cartItem.cartAmount = Number((cartItem.numMeal * cartItem.baseAmount).toFixed(2))
				}
			}
			if ((shoppingcart.data.length === 0) && (shoppingcart.likeItem.length === 0)) {
				// If shoppingcart.data is empty, delete the shopping cart
				// if (isEmail) {
				// 	await ShoppingCart.deleteOne({ email: identifier });
				// } else {
				// 	await ShoppingCart.deleteOne({ sessionId: identifier });
				// }

				await deleteShoppingCart(identifier, isEmail)
				res.status(201).send({ status: "delete" });
			} else {
				// If shoppingcart.data is not empty, update cart and respond
				// Calculate totalAmount
				shoppingcart.totalAmount = shoppingcart.data.reduce((sum, item) => sum + item.cartAmount, 0);
				shoppingcart.totalAmount = Number(shoppingcart.totalAmount.toFixed(2));

				const checkedItem = shoppingcart.data.filter(item => item.checked === true)
				// shoppingcart.checkedItem = checkedItem.length
				shoppingcart.checkedItem = checkedItem.reduce((sum, item) => sum + item.numMeal, 0)
				shoppingcart.checkedAmount = Number(checkedItem.reduce((sum, item) => sum + item.cartAmount, 0).toFixed(2))


				// Calculate totalItem
				shoppingcart.totalItem = shoppingcart.data.reduce((sum, item) => sum + item.numMeal, 0);
				// Asynchronously save the shopping cart to the database.
				let result = await shoppingcart.save();
				// Convert the Mongoose document object to a plain JavaScript object.
				result = result.toObject();
				// Send the request body back as a response.
				res.status(201).send({ result, status: "update" });
			}
		}
	} else if (req.body.event === "like") {
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

module.exports = api;

