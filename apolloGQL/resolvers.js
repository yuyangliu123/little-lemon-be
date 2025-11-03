const { ShoppingCart, Order, Meal, User } = require("../model/models");
const { getCheckoutInfo } = require("../utils/CheckoutPage/getCheckoutInfo");
const { getCheckoutInfoWithDraft } = require("../utils/CheckoutPage/getCheckoutInfoWithDraft");
const { getLikeItemData } = require("../utils/getLikeItemData");
const { getShoppingCart } = require("../utils/getShoppingCart");

const resolvers = {
  Query: {
    shoppingcarts: async (_, { identifier, isEmail }, { user }) => {
      try {
        // 验证用户是否登录
        // if (!user) {
        //   throw new AuthenticationError('You must be logged in');
        // }

        const result = await getShoppingCart(identifier, isEmail)

        console.log("合併後的結果:", result);
        return [result];

      } catch (error) {
        throw new ApolloError("Failed to fetch shopping cart: " + error.message);
      }
    },
    cartitemnumber: async (_, { identifier, isEmail }, { user }) => {
      // if (!user) {
      //   throw new AuthenticationError('You must be logged in');
      // }
      const shoppingCart = isEmail
        ? await ShoppingCart.find({ email: identifier })
        : await ShoppingCart.find({ sessionId: identifier });

      // 如果沒有找到購物車，返回 totalItem 為 0 的物件
      if (!shoppingCart || shoppingCart.length === 0) {
        return [{ totalItem: 0 }];
      }

      // 否則，返回找到的購物車資訊
      return shoppingCart;
    },
    likeitemnumber: async (_, { identifier, isEmail }, { user }) => {
      // if (!user) {
      //   throw new AuthenticationError('You must be logged in');
      // }
      return isEmail
        ? await ShoppingCart.find({ email: identifier })
        : await ShoppingCart.find({ sessionId: identifier })
    },
    likeitemlist: async (_, { identifier, isEmail }, { user }) => {
      const result = await getLikeItemData({ identifier, isEmail })
      return result;
    },
    myorderinfo: async (_, { identifier }, { user }) => {
      // if (!isEmail) {
      //   throw new AuthenticationError('You must be logged in');
      // }
      return await Order.find({ email: identifier });
    },
    orderdetail: async (_, { identifier, uuid }, { user }) => {
      // if (!user) {
      //   throw new AuthenticationError('You must be logged in');
      // }
      return await Order.find({ email: identifier, orderUuid: uuid })
    },
    checkoutpageformat: async (_, { identifier, isEmail, state, useDraft, sessionId }, { user }) => {

      try {
        const user = await User.findOne({ email: identifier });
        // if (!user) {
        //   return res.status(404).send("User not found");
        // }

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
        switch (state) {
          case "create":
            // 如果是首個地址，默認設為默認地址
            if (user.shippingInfo.length === 0) {
              const newAddress = createAddressObject(req.body);
              newAddress.isDefault = true;
              user.shippingInfo.push(newAddress);
            } else {
              // 如果設為默認，需要重置其他默認地址
              if (asDefault) {
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
            const shoppingCart = useDraft ? await getCheckoutInfoWithDraft(sessionId) : await getCheckoutInfo(identifier)

            return {
              cart: shoppingCart,
              shippingInfo: sortShippingInfo(user.shippingInfo),
              fee: shoppingCart.fee?.[0]
            };
        }

        // 保存用戶數據並返回結果
        await user.save();

        return ({
          shippingInfo: sortShippingInfo(user.shippingInfo),
          updatedAddress: updatedAddress
        });
      } catch (error) {
        console.error("獲取購物車數據錯誤:", error);
        throw new ApolloError("Failed to fetch shopping cart: " + error.message);
      }

    },
  },
  Mutation: {
    updatelikelist: async (_, { identifier, isEmail, idMeal, state }) => {
      let shoppingcart = isEmail
        ? await ShoppingCart.findOne({ email: identifier })
        : await ShoppingCart.findOne({ sessionId: identifier })

      if (!shoppingcart) {
        throw new Error("Shopping cart not found");
      }

      if (state === "addtocart") {
        const likedItem = shoppingcart.likeItem.find(item => item.idMeal === idMeal);

        if (likedItem) {
          // 确保创建一个新对象，避免修改原引用
          const itemToAdd = {
            ...likedItem,
            numMeal: 1,  // 明确设置为数字1
            idMeal: likedItem.idMeal,
            checked: false // 确保所有必需字段都有值
          };

          const existingItem = shoppingcart.data.find(item => item.idMeal === idMeal);

          if (!existingItem) {
            shoppingcart.data.push(itemToAdd);
          } else {
            // 安全地增加数量
            existingItem.numMeal = (existingItem.numMeal || 0) + 1;
          }

          shoppingcart.totalItem += 1;
          shoppingcart.likeItem = shoppingcart.likeItem.filter(item => item.idMeal !== idMeal);
        }

      } else if (state === "delete") {
        shoppingcart.likeItem = shoppingcart.likeItem.filter(item => item.idMeal !== idMeal);
      }

      await shoppingcart.save();

      return {
        ...shoppingcart.toObject()
      };
    },
  },
};

module.exports = { resolvers };
