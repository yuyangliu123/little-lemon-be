const { ShoppingCart, Meal } = require("../model/models");

const getLikeItemData = async ({ identifier, isEmail }) => {
  // 根据 isEmail 决定查询条件
  const queryCondition = isEmail
    ? { email: identifier }
    : { sessionId: identifier };
  const shoppingCart = await ShoppingCart.findOne(queryCondition);

  if (!shoppingCart) {
    return null
  }
  // Extract liked item IDs
  const likedItemIds = shoppingCart.likeItem?.map(item => item.idMeal) || [];

  if (likedItemIds.length === 0) {
    return []; // Return early if no liked items
  }

  // Fetch full meal details in a single query
  const likedMeals = await Meal.find({
    idMeal: { $in: likedItemIds }
  });

  // Map to match your ShoppingCart.likeItem structure
  const result = likedMeals.map(meal => ({
    strMeal: meal.strMeal,
    idMeal: meal.idMeal,
    baseAmount: meal.price,
    strMealThumb: meal.strMealThumb,
    // Include any other fields you need from Meal
  }));
  return result
}
module.exports = { getLikeItemData };