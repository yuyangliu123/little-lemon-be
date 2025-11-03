const { ShoppingCart } = require("../model/models");
const { getShoppingCart } = require("./getShoppingCart");

const updateCartState = async (identifier, isEmail, updatedItems) => {
    const session = await ShoppingCart.startSession();
    session.startTransaction();
    try {
        const matchCondition = isEmail
            ? { email: identifier }
            : { sessionId: identifier };

        // 分離需要更新和需要移除的項目
        const itemsToUpdate = updatedItems.filter(item => item.newValue > 0);
        const itemsToRemove = updatedItems.filter(item => item.newValue === 0);

        // 1. 只查詢需要更新或移除的商品（通过 $filter 减少返回数据量）
        const allRelevantMealIds = updatedItems.map(u => u.idMeal);
        const cart = await ShoppingCart.aggregate([
            { $match: matchCondition },
            {
                $project: {
                    totalItem: 1,
                    data: {
                        $filter: {
                            input: "$data",
                            as: "item",
                            cond: { $in: ["$$item.idMeal", allRelevantMealIds] }
                        }
                    }
                }
            }
        ]).session(session);

        if (!cart || cart.length === 0) throw new Error('cart not exist');
        const cartData = cart[0];

        // 2. calc totalDifference 並準備更新操作
        let totalDifference = 0;
        const bulkOps = [];

        // 處理需要更新的項目
        itemsToUpdate.forEach(item => {
            const oldItem = cartData.data.find(i => i.idMeal === item.idMeal);
            if (!oldItem) throw new Error(`meal ${item.idMeal} not in cart`);

            const difference = item.newValue - oldItem.numMeal;
            totalDifference += difference;

            bulkOps.push({
                updateOne: {
                    filter: { ...matchCondition, "data.idMeal": item.idMeal },
                    update: {
                        $set: {
                            "data.$.numMeal": item.newValue,
                            "data.$.checked": item.newCheckedState
                        }
                    }
                }
            });
        });

        // 處理需要移除的項目
        itemsToRemove.forEach(item => {
            const oldItem = cartData.data.find(i => i.idMeal === item.idMeal);
            if (oldItem) { // 確保該項目存在於購物車中才進行移除操作和數量計算
                totalDifference -= oldItem.numMeal; // 移除的項目會減少購物車總數
                bulkOps.push({
                    updateOne: {
                        filter: { ...matchCondition },
                        update: {
                            $pull: { data: { idMeal: item.idMeal } } // 使用 $pull 移除元素
                        }
                    }
                });
            }
        });

        // 3. 執行批次寫入操作
        if (bulkOps.length > 0) {
            await ShoppingCart.bulkWrite(bulkOps, { session });
        }

        // 4. update totalItem
        await ShoppingCart.updateOne(
            matchCondition,
            { $inc: { totalItem: totalDifference } },
            { session }
        );

        await session.commitTransaction();
        const result = await getShoppingCart(identifier, isEmail);

        return result || {
            totalAmount: 0,
            totalItem: 0,
            checkedAmount: 0,
            checkedItem: 0,
            data: []
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

module.exports = { updateCartState };