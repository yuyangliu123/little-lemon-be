const { ShoppingCart } = require("../model/models");

const findInitialShoppingCart=async(identifier,isEmail)=>{
    return isEmail
        ? await ShoppingCart.findOne({ email: identifier })
        : await ShoppingCart.findOne({ sessionId: identifier });
}

module.exports={findInitialShoppingCart}