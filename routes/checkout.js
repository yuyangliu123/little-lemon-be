//--------------------------------------------------------------------------------------------------//
// To connect with mongoDB database
const mongoose = require('./db');
//--------------------------------------------------------------------------------------------------//
// For backend and express
const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const cors = require("cors");
const { string } = require('yup');
const { User, ShoppingCart, Fee, Order, CheckoutDraft } = require('../model/models');
console.log("App listen at port 5000");
const { jwtDecode } = require('jwt-decode');
// const { Reservation } = require('./model/models');
const { getNextOrderNumber } = require('../utils/orderNumberGenerator');
const { getCheckoutInfo } = require('../utils/CheckoutPage/getCheckoutInfo');
const { getInitialUserInfo } = require('../utils/getInitialUserInfo');
const { getShoppingCart } = require('../utils/getShoppingCart');
const { findInitialShoppingCart } = require('../utils/findInitialShoppingCart');
const { getCheckoutInfoWithDraft } = require('../utils/CheckoutPage/getCheckoutInfoWithDraft');
app.use(express.json());
app.use(cors());

//set sign of cookie
app.use(cookieParser())
const corsOptions = {
	origin: 'http://localhost:3000', // Change to frontend's URL
	credentials: true, // Allow credentials (cookies, authorization headers, etc.)
};
app.use(cors(corsOptions));
app.get("/", (req, resp) => {

	resp.send("App is Working");
	// Can check backend is working or not by
	// entering http://localhost:5000
	// If you see App is working means
	// backend working properly
});

app.post('/checkoutInfo', async (req, res) => {
	try {
		const { identifier, isEmail } = await getInitialUserInfo(req)
		const user = await User.findOne({ email: identifier });
		if (!user) {
			return res.status(404).send("User not found");
		}

		// 處理地址排序邏輯 - 將默認地址放在最前面
		const sortShippingInfo = (addresses) => {
			const defaultIndex = addresses.findIndex(item => item.isDefault === true);
			if (defaultIndex === -1) return addresses;

			const sorted = [...addresses];
			const defaultAddress = sorted.splice(defaultIndex, 1)[0];
			return [defaultAddress, ...sorted];
		};

		// 設置默認地址的輔助函數
		const setDefaultAddress = (addresses) => {
			// 先將所有地址設為非默認
			const originDefault = addresses.findIndex(item => item.isDefault === true)
			addresses[originDefault].isDefault = false

		};

		// 創建新地址對象
		const createAddressObject = (data) => ({
			addressFname: data.addressFname,
			addressLname: data.addressLname,
			phone: data.phone,
			address1: data.address1,
			address2: data.address2,
			city: data.city,
			country: data.country,
			isDefault: data.asDefault
		});

		let updatedAddress = null;

		// 根據操作類型處理不同邏輯
		switch (req.body.state) {
			case "create":
				// 如果是首個地址，默認設為默認地址
				if (user.shippingInfo.length === 0) {
					const newAddress = createAddressObject(req.body);
					newAddress.isDefault = true;
					user.shippingInfo.push(newAddress);
				} else {
					// 如果設為默認，需要重置其他默認地址
					if (req.body.asDefault) {
						setDefaultAddress(user.shippingInfo);
					}

					const newAddress = createAddressObject(req.body);
					user.shippingInfo.push(newAddress);
				}
				updatedAddress = user.shippingInfo[user.shippingInfo.length - 1];
				break;

			case "delete":
				user.shippingInfo = user.shippingInfo.filter(
					info => info.uuid !== req.body.uuid
				);

				// 如果還有地址，將最後一個設為默認地址
				if (user.shippingInfo.length > 0) {
					user.shippingInfo[user.shippingInfo.length - 1].isDefault = true;
					updatedAddress = user.shippingInfo[user.shippingInfo.length - 1];
				}
				break;

			case "update":
				const index = user.shippingInfo.findIndex(
					info => info.uuid === req.body.uuid
				);
				if (index !== -1) {
					// 如果設為默認，需要重置其他默認地址
					if (req.body.asDefault) {
						setDefaultAddress(user.shippingInfo);
					}

					// 保留原有的uuid和_id等系統字段
					user.shippingInfo[index] = {
						...user.shippingInfo[index],
						...createAddressObject(req.body)
					};

					updatedAddress = user.shippingInfo[index];
				}
				break;

			case "proposal":
				const shoppingCart = await getCheckoutInfo(identifier)
				console.log("getCheckoutInfoStart", shoppingCart, "getCheckoutInfo");

				return res.status(200).send({
					shoppingCart: shoppingCart,
					shippingInfo: sortShippingInfo(user.shippingInfo),
				});
		}

		// 保存用戶數據並返回結果
		await user.save();

		res.status(200).send({
			shippingInfo: sortShippingInfo(user.shippingInfo),
			updatedAddress: updatedAddress
		});
	} catch (error) {
		res.status(500).send(`Something went wrong ${error.message}`);
	}
});

//--------------------------------------------------------------------------------------------------//


//--------------------------------------------------------------------------------------------------//
// This route handler processes user registration requests for the '/register' path.
app.post('/checkout', async (req, res) => {
	///要修改成原子性///////////////////////////

	const { identifier, isEmail } = await getInitialUserInfo(req)

	// Check if there is cart data in the database
	try {
		const { selectedAddress, shippingMethod, shippingFee, payment, cardNumber, useDraft } = req.body;

		let shoppingcart = useDraft ? await getCheckoutInfoWithDraft(req.cookies.sessionId) : await getShoppingCart(identifier, isEmail);

		if (!shoppingcart || shoppingcart.checkedItem === 0) {

			return res.status(400).json({ message: "No items selected for checkout" });
		}
		//here
		const checkedItems = shoppingcart.data.filter(item => item.checked);


		const address = req.body.addressInfo
		const orderNumber = await getNextOrderNumber();
		//  創建新訂單
		const newOrder = new Order({
			email: identifier,
			orderNumber: orderNumber,
			shippingMethod: shippingMethod,
			shippingFee: shippingFee,
			orderAmount: Number(checkedItems.reduce((sum, item) => sum + item.cartAmount, 0).toFixed(2)),
			orderItem: checkedItems.reduce((sum, item) => sum + item.numMeal, 0),
			payment: payment,
			creditCardNumber: cardNumber ? String(cardNumber).slice(-4) : null,
			createdAt: new Date(),
			addressInfo: {
				addressFname: address.addressFname,
				addressLname: address.addressLname,
				phone: address.phone,
				address1: address.address1,
				address2: address.address2,
				city: address.city,
				country: address.country
			},
			itemInfo: checkedItems.map((item) => ({
				strMeal: item.strMeal,
				strMealThumb: item.strMealThumb,
				idMeal: item.idMeal,
				numMeal: item.numMeal,
				baseAmount: item.baseAmount,
				cartAmount: item.cartAmount,
			}))

		})

		await newOrder.save();

		if (useDraft) {
			await CheckoutDraft.deleteOne({ sessionId: req.cookies.sessionId })
		} else {

			const originShoppingCart = await findInitialShoppingCart(identifier, isEmail)
			console.log(originShoppingCart, "originShoppingCart");
			originShoppingCart.data = originShoppingCart.data.filter(item => !item.checked)
			originShoppingCart.totalItem = originShoppingCart.data.reduce((sum, item) => sum + item.numMeal, 0);
			await originShoppingCart.save();

		}
		res.status(200).json({ message: "Order created successfully", orderNumber });
	}
	catch (e) {
		res.status(500).send('something went wrong', e);
	}
});


module.exports = app;

