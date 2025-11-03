const { ShoppingCart } = require("../model/models");

const deleteShoppingCart=async(identifier,isEmail)=>{
    return isEmail
        ? await ShoppingCart.deleteOne({ email: identifier })
        : await ShoppingCart.deleteOne({ sessionId: identifier });
}

module.exports={deleteShoppingCart}