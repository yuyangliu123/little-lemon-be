const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://c34klh:wiisport147@little-lemon001.sc2x5oo.mongodb.net/?retryWrites=true&w=majority&appName=little-lemon001'
).then(() => {
	console.log('Connected to little-lemon database');
}).catch((err) => {
	console.log(err);
});


// For backend and express
const express = require('express');
const https = require("https")
const fs = require("fs")
const api = express();
const cors = require("cors");
const { Meal } = require('../model/models');
const { string } = require('yup');
console.log("App listen at port 5000");
api.use(express.json());
api.use(cors());
api.get("/", (req, resp) => {

	resp.send("App is Working");
	// Can check backend is working or not by
	// entering http://localhost:5000
	// If you see App is working means
	// backend working properly
});
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

