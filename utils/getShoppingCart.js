const { default: mongoose } = require("../routes/db");
const { ShoppingCart } = require("../model/models");

const getShoppingCart = async (identifier, isEmail) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            throw new Error('MongoDB 连接未就绪');
        }

        // 根据 isEmail 决定匹配条件
        const matchCondition = isEmail
            ? { email: identifier }
            : { sessionId: identifier };

        const result = await ShoppingCart.aggregate([
            { $match: matchCondition },  // 使用动态匹配条件
            { $unwind: "$data" },
            {
                $lookup: {
                    from: "meal-datas",
                    localField: "data.idMeal",
                    foreignField: "idMeal",
                    as: "mealInfo"
                }
            },
            { $unwind: { path: "$mealInfo", preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    "mergedData": {
                        $mergeObjects: [
                            "$mealInfo",
                            {
                                baseAmount: { $round: ["$mealInfo.price", 2] },
                                cartAmount: {
                                    $round: [
                                        { $multiply: ["$data.numMeal", "$mealInfo.price"] },
                                        2
                                    ]
                                },
                                numMeal: "$data.numMeal",
                                checked: "$data.checked",
                                _id: "$data._id"
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: "$_id",
                    email: { $first: "$email" },
                    sessionId: { $first: "$sessionId" },  // 保留 sessionId
                    totalItem: { $first: "$totalItem" },
                    Date: { $first: "$Date" },
                    likeItem: { $first: "$likeItem" },
                    data: { $push: "$mergedData" },
                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $and: ["$data.numMeal", "$mealInfo.price"] },
                                { $multiply: ["$data.numMeal", "$mealInfo.price"] },
                                0
                            ]
                        }
                    },
                    checkedAmount: {
                        $sum: {
                            $cond: [
                                { $and: ["$data.checked", "$data.numMeal", "$mealInfo.price"] },
                                { $multiply: ["$data.numMeal", "$mealInfo.price"] },
                                0
                            ]
                        }
                    },
                    checkedItem: {
                        $sum: {
                            $cond: [
                                { $and: ["$data.checked", "$data.numMeal"] },
                                "$data.numMeal",
                                0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    email: 1,
                    sessionId: 1,  // 包含 sessionId 在返回结果中
                    totalItem: 1,
                    Date: 1,
                    likeItem: 1,
                    data: 1,
                    checkedItem: 1,
                    totalAmount: { $round: ["$totalAmount", 2] },
                    checkedAmount: { $round: ["$checkedAmount", 2] }
                }
            }
        ]);

        return result[0] || {
            totalAmount: 0,
            totalItem: 0,
            checkedAmount: 0,
            checkedItem: 0,
            data: []
        };
    } catch (error) {
        console.error('購物車數據獲取失敗:', error);
        return {
            totalAmount: 0,
            totalItem: 0,
            checkedAmount: 0,
            checkedItem: 0,
            data: []
        };
    }
}

module.exports = { getShoppingCart };