const gql = require('graphql-tag');

//Setting different query names for each independent query can prevent Query Merging or Query Interference.

const typeDefs = gql`
scalar Date
type Query {
  shoppingcarts(identifier: String, isEmail:Boolean): [ShoppingCart]
  cartitemnumber(identifier: String, isEmail:Boolean): [ShoppingCart]
  likeitemnumber(identifier: String, isEmail:Boolean): [ShoppingCart]
  likeitemlist(identifier: String, isEmail:Boolean): [LikeItem]
  myorderinfo(identifier: String, isEmail:Boolean): [OrderData]
  orderdetail(identifier: String, isEmail:Boolean, uuid: String): [OrderData]
  checkoutpageformat(identifier: String, isEmail:Boolean,state:String, useDraft: Boolean, sessionId:String): CheckoutResult
}
type Mutation {
  updatelikelist(identifier: String, isEmail:Boolean, idMeal: String, baseAmount: Float, state: String): ShoppingCart
}
type ShoppingCart {
  email: String
  sessionId: String
  totalAmount: Float
  totalItem: Int
  checkedAmount: Float
  checkedItem: Int
  data: [MealData]
  likeItem: [LikeItem]
  shippingInfo: [AddressInfo]
  fee: FeeInfo
}
type MealData {
  strMeal: String
  numMeal: Int
  idMeal: String
  baseAmount: Float
  cartAmount: Float
  strMealThumb: String
  checked: Boolean
}
type LikeItem {
  strMeal: String
  idMeal: String
  baseAmount: Float
  cartAmount: Float
  strMealThumb: String
}
type OrderData {
  email: String
  orderNumber: String
  shippingMethod: String
  shippingFee: Float
  discount: Boolean
  discountCode: String
  payment: String
  creditCardNumber: Int
  createdAt: Date
  orderUuid: String
  orderAmount: Float
  orderItem: Int
  addressInfo: [AddressInfo]
  itemInfo: [ItemInfo]
}
type ItemInfo {
  numMeal: Int
  idMeal: String
  baseAmount: Float
  strMeal: String
  strMealThumb: String
  cartAmount: Float
}
type AddressInfo  {
  addressFname: String
  addressLname: String
  phone: String
  address1: String
  address2: String
  city: String
  country: String
  uuid: String,
  isDefault:Boolean,

},
type FeeInfo {
  fee: FeeDetail
},

type FeeDetail {
  basic: Float
  premium: Float
}

type CheckoutResult {
  cart: ShoppingCart
  fee: FeeInfo
  shippingInfo: [AddressInfo]
}

type CheckoutDraft {
sessionId: String
totalItem: Float
data: [DraftData]
createdAt: Date
}

type DraftData {
numMeal: Float
idMeal: String
checked: Boolean
}
`


  ;

module.exports = { typeDefs };