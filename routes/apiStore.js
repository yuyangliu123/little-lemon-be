const mongoose = require('mongoose');
mongoose.connect(`mongodb+srv://c34klh:${process.env.DB_PASSWORD}@little-lemon001.sc2x5oo.mongodb.net/?retryWrites=true&w=majority&appName=little-lemon001`
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
	path: path.resolve(__dirname, '..', envFileName)
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
	console.log('🏃 正在獲取外部菜單數據...');
	try {
		const categoriesResponse = await getHttpsData('https://www.themealdb.com/api/json/v1/1/list.php?c=list');
		const mealsToInsert = [];

		// 使用 Promise.all 加速類別數據獲取
		const categoryPromises = categoriesResponse.meals.map(async (category) => {
			const strCategory = category.strCategory;
			const mealsData = await getHttpsData(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${strCategory}`);

			if (mealsData.meals) {
				mealsData.meals.forEach(mealData => {
					const price = Number((Number(mealData.idMeal) / 10000 + Math.random() * 10).toFixed(2));
					mealsToInsert.push({
						category: strCategory,
						strMeal: mealData.strMeal,
						strMealThumb: mealData.strMealThumb,
						idMeal: mealData.idMeal,
						price: price,
						Date: new Date(),
					});
				});
			}
		});

		await Promise.all(categoryPromises);

		console.log(`✨ 總共收集到 ${mealsToInsert.length} 筆菜單數據。開始批量寫入...`);

		// 使用 insertMany 批量寫入，極大地提高效率
		await Meal.insertMany(mealsToInsert, { ordered: false });

		console.log('✅ 菜單數據初始化成功！');
	} catch (err) {
		console.error("❌ Error initializing data:", err.message);
	}
}





const updateData = async () => {
	console.log('🔄 正在執行每小時菜單更新...');
	try {
		const categoriesResponse = await getHttpsData('https://www.themealdb.com/api/json/v1/1/list.php?c=list');
		const updatePromises = [];

		// 使用 Promise.all 加速類別數據獲取和更新
		for (let category of categoriesResponse.meals) {
			const strCategory = category.strCategory;
			const mealsData = await getHttpsData(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${strCategory}`);

			if (mealsData.meals) {
				mealsData.meals.forEach(mealData => {
					const { strMeal, strMealThumb, idMeal } = mealData;
					// 價格僅在插入時設定
					const updatePromise = Meal.findOneAndUpdate(
						{ idMeal },
						{
							$set: { category, strMeal, strMealThumb, idMeal },
							$setOnInsert: {
								// 每次更新時重新計算一個新價格 
								price: Number((Number(idMeal) / 10000 + Math.random() * 10).toFixed(2))
							}
						},
						{ upsert: true, new: true, runValidators: true }
					);
					updatePromises.push(updatePromise);
				});
			}
		}

		await Promise.all(updatePromises);
		console.log('✅ 菜單數據更新完成！');

	} catch (err) {
		console.error("❌ Error updating data: " + err.message);
	}
};
// Run the update function every hour
mongoose.connection.once('open', async () => {
	console.log('--- MongoDB 連線已開啟，開始應用程式啟動檢查 ---');
	try {
		// 檢查數據是否需要初始化
		const count = await Meal.countDocuments();
		if (count === 0) {
			console.log('🍽️ 菜單集合為空，正在進行初始化...');
			await createData();
		} else {
			console.log(`🍽️ 菜單集合已包含 ${count} 筆數據，跳過初始化。`);
		}

		// 啟動定時更新任務
		// 立即執行一次更新，然後每小時執行一次
		updateData();
		setInterval(updateData, 60 * 60 * 1000);

		// 啟動 Express 伺服器
		api.listen(5001, () => {
			console.log(`🚀 API server is running on http://localhost:5001`);
		});

	} catch (error) {
		console.error('❌ 應用程式初始化失敗:', error);
		process.exit(1);
	}
});


//--------------------------------------------------------------------------------------------------//




module.exports = api;

