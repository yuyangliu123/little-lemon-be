const { ShoppingCart, CheckoutDraft } = require("../model/models");

const unAuthMergeCart = async (identifier, isEmail, sessionId) => {
    const session = await ShoppingCart.startSession();
    console.log("unAuthMergeCart start");
    
    session.startTransaction();

    try {
        // 1. 查找匿名用戶購物車
        const anonymousCart = await ShoppingCart.findOne({ sessionId }).session(session);
        if (!anonymousCart) {
            await session.abortTransaction();
            return {
                totalAmount: 0,
                totalItem: 0,
                checkedAmount: 0,
                checkedItem: 0,
                data: []
            };
        }

        // 2. 更新或創建 CheckoutDraft
        const checkedItems = anonymousCart.data.filter(item => item.checked);
        const draftData = {
            sessionId,
            totalItem: anonymousCart.totalItem,
            data: checkedItems
        };

        await CheckoutDraft.findOneAndUpdate(
            { sessionId },
            draftData,
            { upsert: true, new: true, session }
        );

        // 3. 執行聚合查詢
        const result = await CheckoutDraft.aggregate([
            { $match: { sessionId } },
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
                $group: {
                    _id: "$_id",
                    sessionId: { $first: "$sessionId" },
                    totalItem: { $first: "$totalItem" },
                    data: {
                        $push: {
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
                    },
                    totalAmount: {
                        $sum: {
                            $multiply: ["$data.numMeal", "$mealInfo.price"]
                        }
                    },
                    checkedAmount: {
                        $sum: {
                            $cond: [
                                "$data.checked",
                                { $multiply: ["$data.numMeal", "$mealInfo.price"] },
                                0
                            ]
                        }
                    },
                    checkedItem: {
                        $sum: {
                            $cond: [
                                "$data.checked",
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
                    totalItem: 1,
                    data: 1,
                    checkedItem: 1,
                    totalAmount: { $round: ["$totalAmount", 2] },
                    checkedAmount: { $round: ["$checkedAmount", 2] }
                }
            }
        ]).session(session);

        await session.commitTransaction();
        console.log("unAuthMergeCart success");

        return result[0] || {
            totalAmount: 0,
            totalItem: 0,
            checkedAmount: 0,
            checkedItem: 0,
            data: []
        };
    } catch (error) {
        await session.abortTransaction();
        console.log("error inside unAuthMergeCart",error);
        
        throw error;
    } finally {
        console.log("unAuthMergeCart end");
        
        session.endSession();
    }
};

module.exports = { unAuthMergeCart };