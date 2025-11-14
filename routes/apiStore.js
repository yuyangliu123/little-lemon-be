const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://c34klh:wiisport147@little-lemon001.sc2x5oo.mongodb.net/?retryWrites=true&w=majority&appName=little-lemon001'
).then(() => {
	console.log('Connected to little-lemon database');
}).catch((err) => {
	console.log(err);
});


const dotenv = require('dotenv');
const path = require('path');

// 1. 判斷當前環境
//    - process.env.NODE_ENV 會由您的 npm 腳本或部署環境來設定。
//    - 如果沒有設定，預設為 'development'。
const currentEnv = process.env.NODE_ENV || 'development';

// 2. 根據環境決定要載入的 .env 檔案名稱
const envFileName = `.env.${currentEnv}`;

console.log(`正在載入環境檔案: ${envFileName}`);

// 3. 載入指定的 .env 檔案
//    config() 會將檔案中的變數注入到 process.env 中
dotenv.config({
	path: path.resolve(__dirname,'..', envFileName)
});

// ----------------------------------------------------
// 在這裡之後，您就可以使用 process.env 來存取變數了
// ----------------------------------------------------

const port = process.env.PORT;
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS.split(',').map(url => url.trim());

// For backend and express
const express = require('express');
const https = require("https")
const fs = require("fs")
const api = express();
const cors = require("cors");
const { Meal } = require('../model/models');
const { string } = require('yup');
api.use(express.json());
api.use(cors());
//--------------------------------------------------------------------------------------------------//

//--------------------------------------------------------------------------------------------------//
// This route handler processes user registration requests for the '/register' path.
const getHttpsData = (url) => {
	return new Promise((resolve, reject) => {
		https.get(url, (resp) => {
			let data = '';
			resp.on('data', (chunk) => {
				data += chunk;
			});
			resp.on('end', () => {
				resolve(JSON.parse(data));
			});
			resp.on('error', (err) => {
				reject(err);
			});
		});
	});
};
const createData = async () => {
	try {
		const categoriesResponse = await getHttpsData('https://www.themealdb.com/api/json/v1/1/list.php?c=list');
		let categoriesData = {};
		for (let category of categoriesResponse.meals) {
			const strCategory = category.strCategory;
			const mealsData = await getHttpsData(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${strCategory}`);
			categoriesData[strCategory] = mealsData.meals;
		}
		Object.entries(categoriesData).map(([category, meals]) => {
			meals.forEach(mealData => {
				let meal = new Meal({
					category: category,
					strMeal: mealData.strMeal,
					strMealThumb: mealData.strMealThumb,
					idMeal: mealData.idMeal,
					price: Number((Number(mealData.idMeal) / 10000 + Math.random() * 10).toFixed(2))
				});
				meal.save();
			});
		})
	} catch (err) {
		console.log("Error: " + err.message);
	}
}

(async () => {
	const count = await Meal.countDocuments();
	if (count === 0) {
		createData();
	}
})();



const updateData = async () => {
	try {
		const categoriesResponse = await getHttpsData('https://www.themealdb.com/api/json/v1/1/list.php?c=list');
		let categoriesData = {};
		for (let category of categoriesResponse.meals) {
			const strCategory = category.strCategory;
			const mealsData = await getHttpsData(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${strCategory}`);
			categoriesData[strCategory] = mealsData.meals;
		}
		Object.entries(categoriesData).map(([category, meals]) => {
			meals.forEach(async mealData => {
				const { strMeal, strMealThumb, idMeal } = mealData;
				const price = Number((Number(idMeal) / 10000 + Math.random() * 10).toFixed(2));
				await Meal.findOneAndUpdate(
					{ idMeal },
					{
						$set: { category, strMeal, strMealThumb, idMeal },
						$setOnInsert: { price }
					},
					{ upsert: true }
				);
			});
		});
	} catch (err) {
		console.log("Error: " + err.message);
	}
};
// Run the update function every hour
setInterval(updateData, 60 * 60 * 1000);


api.listen(5001, () => {
	console.log(`API server is running on http://localhost:5001`);
})

//--------------------------------------------------------------------------------------------------//




module.exports = api;

