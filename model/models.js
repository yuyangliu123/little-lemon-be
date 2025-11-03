// models.js
const mongoose = require('../routes/db');
const { v4: uuidv4 } = require('uuid');
const ReserveSchema = new mongoose.Schema({
	fname: {
		type: String,
		required: true,
	},
	email: {
		type: String,
		required: true,
	},
	numberOfPeople: {
		type: String,
		required: true,
	},
	resTime: {
		type: String,
		required: true,
	},
	resDate: {
		type: Date,
		required: true,
	},
	occasion: {
		type: String,
		required: true,
	},
	Date: {
		type: Date,
		default: Date.now,
	},
});

const RefreshSchema = new mongoose.Schema({
	refreshToken: {
		type: String,
		required: true,
		unique: true,
	},
	// accessToken: {
	// 	type: String,
	// 	required: true,
	// },
	// accessToken: {
	// 	type: String,
	// 	required: true,
	// },
	// email: {
	// 	type: String,
	// 	required: true,
	// },
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User', // 引用 User 模型
		required: true
	},
	sessionId: {
		type: String,
		default: () => uuidv4(), // 為每次登入生成唯一的會話 ID
		required: true,
		unique: true // <-- 關鍵：確保每個會話 ID 都是唯一的
	},
	createdAt: {
		type: Date,
		default: Date.now,
		expires: '1d', // token will be deleted after expired(1 day)
	},
	lastUsedAt: {
		type: Date,
		default: Date.now
	},
	ipAddress: {
		type: String,
		required: false
	},
	userAgent: {
		type: String,
		required: false
	},
});
RefreshSchema.index({ user: 1 }); // 查詢一個用戶的所有刷新令牌
RefreshSchema.index({ refreshToken: 1 }); // 快速查找特定的刷新令牌
RefreshSchema.index({ sessionId: 1 }); // 快速查找特定的會話

const MealSchema = new mongoose.Schema({
	category: {
		type: String,
		require: true
	},
	strMeal: {
		type: String,
		required: true,
	},
	strMealThumb: {
		type: String,
		// required: true,
	},
	idMeal: {
		type: String,
		required: true,
	},
	price: {
		type: Number,
		require: true
	},
	Date: {
		type: Date,
		default: Date.now,
	},
});

const ShoppingCartSchema = new mongoose.Schema({
	email: {
		type: String,
		unique: true,
		sparse: true
	},
	sessionId: {
		type: String,
		unique: true,
		sparse: true
	},
	// totalAmount: {
	// 	type: Number,
	// },
	totalItem: {
		type: Number,
	},
	// checkedAmount: {
	// 	type: Number,
	// 	default: 0
	// },
	// checkedItem: {
	// 	type: Number,
	// 	default: 0
	// },
	data: [{
		numMeal: {
			type: Number,
		},
		idMeal: {
			type: String,
		},
		checked: {
			type: Boolean,
			default: false
		}
	}],
	likeItem: [{
		idMeal: {
			type: String,
		},
	}],
	Date: {
		type: Date,
		default: Date.now,
	},
});
// 添加索引以提高查找效率，並且確保至少有一個識別符存在
ShoppingCartSchema.index({ email: 1 }, { unique: true, sparse: true });
ShoppingCartSchema.index({ sessionId: 1 }, { unique: true, sparse: true });

// 確保每次只有一個識別符存在
ShoppingCartSchema.pre('save', function (next) {
	if (this.email && this.sessionId) {
		return next(new Error('A shopping cart cannot have both an email and a session ID.'));
	}
	if (!this.email && !this.sessionId) {
		return next(new Error('A shopping cart must have either an email or a session ID.'));
	}
	next();
});

const CheckoutDraftSchema = new mongoose.Schema({
	sessionId: {
		type: String,
		unique: true,
		sparse: true
	},
	// totalAmount: {
	// 	type: Number,
	// },
	totalItem: {
		type: Number,
	},
	// checkedAmount: {
	// 	type: Number,
	// 	default: 0
	// },
	// checkedItem: {
	// 	type: Number,
	// 	default: 0
	// },
	data: [{
		numMeal: {
			type: Number,
		},
		idMeal: {
			type: String,
		},
		checked: {
			type: Boolean,
			default: true
		}
	}],
	createdAt: {
		type: Date,
		default: Date.now, // 預設值為當前時間
		expires: '1h'      // 設定文檔在建立後 1 小時過期並自動刪除
	}
});
// const LikeItemSchema = new mongoose.Schema({
// 	email: {
// 		type: String,
// 		required: true,
// 	},
// 	likeItem: [{
// 		idMeal: {
// 			type: String,
// 		},
// 	}],
// 	Date: {
// 		type: Date,
// 		default: Date.now,
// 	},
// });

const UserSchema = new mongoose.Schema({
	fname: {
		type: String,
		required: true,
	},
	lname: {
		type: String,
		required: true,
	},
	email: {
		type: String,
		required: true,
	},
	password: {
		type: String,
		required: true,
	},
	shippingInfo: [{
		addressFname: {
			type: String,
			// default:""
		},
		addressLname: {
			type: String,
			// default:""
		},
		phone: {
			type: String
		},
		address1: {
			type: String
		},
		address2: {
			type: String
		},
		city: {
			type: String
		},
		country: {
			type: String
		},
		uuid: {
			type: String,
			default: () => uuidv4()
		},
		isDefault: {
			type: Boolean,
			default: false
		},
	}],
	Date: {
		type: Date,
		default: Date.now,
	},
});


const ResetSchema = new mongoose.Schema({
	email: {
		type: String,
		required: true,
	},
	token: {
		type: String,
		require: true
	},
	createdAt: {
		type: Date,
		default: Date.now,
		expires: process.env.TOKEN_LIFE_TIME , // token will be deleted 10m later automatically
	},
});

const OrderCounterSchema = new mongoose.Schema({
	_id: {
		type: String,
		required: true
	},
	seq: {
		type: Number,
		default: 0
	}
});
const FeeSchema = new mongoose.Schema({
	fee: {
		basic: {
			type: Number,
			default: 4.99
		},
		premium: {
			type: Number,
			default: 7.99
		}
	},
	discount1Dollar: {
		type: Number,
		default: 1
	},
	discount3Dollar: {
		type: Number,
		default: 3
	},
});

const OrderSchema = new mongoose.Schema({
	email: {
		type: "String",
		require: true
	},
	orderNumber: {
		type: String,
	},
	shippingMethod: {
		type: String
	},
	shippingFee: {
		type: Number
	},
	discount: {
		type: Boolean,
		default: false
	},
	discountCode: {
		type: String
	},
	payment: {
		type: String
	},
	creditCardNumber: {
		type: Number,
		default: null
	},
	orderAmount: {
		type: Number
	},
	orderItem: {
		type: Number
	},
	createdAt: {
		type: Date
	},
	orderUuid: {
		type: String,
		default: () => uuidv4()
	},
	addressInfo: [{
		addressFname: {
			type: String,
			// default:""
		},
		addressLname: {
			type: String,
			// default:""
		},
		phone: {
			type: String
		},
		address1: {
			type: String
		},
		address2: {
			type: String
		},
		city: {
			type: String
		},
		country: {
			type: String
		},
	}],
	itemInfo: [{
		strMeal: {
			type: String,
		},
		numMeal: {
			type: Number,
		},
		idMeal: {
			type: String,
		},
		baseAmount: {
			type: Number,
		},
		cartAmount: {
			type: Number,
		},
		strMealThumb: {
			type: String,
		},
	}],
});

const Reservation = mongoose.models.Reservation || mongoose.model('Reservation', ReserveSchema);
Reservation.createIndexes()
const RefreshToken = mongoose.models.RefreshToken || mongoose.model('RefreshToken', RefreshSchema);
const Meal = mongoose.models.Meal || mongoose.model('meal-data', MealSchema);
const ShoppingCart = mongoose.models.ShoppingCart || mongoose.model('shopping-cart1', ShoppingCartSchema);
const CheckoutDraft = mongoose.models.CheckoutDraftSchema || mongoose.model('CheckoutDraft', CheckoutDraftSchema);

// const LikeItem = mongoose.models.LikeItem || mongoose.model('likeitem', LikeItemSchema);
const User = mongoose.models.User || mongoose.model('sign-up-data', UserSchema);
const Reset = mongoose.models.Reset || mongoose.model('reset-password', ResetSchema);
const OrderCounter = mongoose.models.OrderCounter || mongoose.model('order-counter', OrderCounterSchema);
const Fee = mongoose.models.Fee || mongoose.model('fee', FeeSchema);
const Order = mongoose.models.Order || mongoose.model('order', OrderSchema);

Meal.collection.createIndex({ category: 1 });
Meal.collection.createIndex({ price: 1 })

module.exports = { Reservation, RefreshToken, Meal, ShoppingCart, CheckoutDraft, User, Reset, OrderCounter, Fee, Order };
