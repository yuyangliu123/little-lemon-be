const { OrderCounter } = require('../model/models');

async function getNextOrderNumber() {
    const counter = await OrderCounter.findByIdAndUpdate(
        'orderNumber',
        { $inc: { seq: 1 } },//ncrements the numeric value
        {
            new: true, //return the modified document 
            upsert: true //insert a new document
        }
    );

    // 格式化為6位數，前面補0
    const formattedNumber = counter.seq.toString().padStart(6, '0');

    return formattedNumber;
}

module.exports = { getNextOrderNumber };