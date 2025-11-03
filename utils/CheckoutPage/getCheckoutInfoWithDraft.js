const { default: mongoose } = require("../../routes/db");
const { ShoppingCart, CheckoutDraft } = require("../../model/models");


const getCheckoutInfoWithDraft = async (identifier) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            throw new Error('MongoDB 连接未就绪');
        }

        const result = await CheckoutDraft.aggregate([
            { $match: { sessionId:identifier } },
            { $unwind: "$data" },
            { $match: { "data.checked": true } },
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
                $lookup: {
                    from: "fees", // 请确保您的 fees 集合名称正确
                    pipeline: [],
                    // fees 集合通常没有 localField 和 foreignField，因为它可能是一个固定费用表
                    // 如果 fees 集合中有特定的字段需要匹配，请在这里添加 localField 和 foreignField
                    // 例如：localField: "someFieldInShoppingCart", foreignField: "someFieldInFees"
                    as: "feeData"
                }
            },
            {
                $addFields: {
                    "mergedData": {
                        $mergeObjects: [
                            "$mealInfo",
                            {
                                baseAmount: { $round: ["$mealInfo.price", 2] }, // 单价也保留2位小数
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
                },
            },
            {
                $group: {
                    _id: "$_id",
                    sessionId: { $first: "$sessionId" },
                    Date: { $first: "$Date" },
                    data: { $push: "$mergedData" },  // 这里使用 mergedData 替代原来的 data
                    fee: { $first: "$feeData" },
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
                    sessionId: 1,
                    Date: 1,
                    likeItem: 1,
                    data: 1,
                    fee:1,
                    checkedItem: 1,
                    checkedAmount: { $round: ["$checkedAmount", 2] }
                }
            }
        ]);

        return result[0] || {
            checkedAmount: 0,
            checkedItem: 0,
            data: []
        };
    } catch (error) {
        console.error('购物车数据获取失败:', error);
        return {
            checkedAmount: 0,
            checkedItem: 0,
            data: []
        };
    }
}

module.exports = { getCheckoutInfoWithDraft };