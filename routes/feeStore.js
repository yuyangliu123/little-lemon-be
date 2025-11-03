//feeStore.js
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://c34klh:wiisport147@little-lemon001.sc2x5oo.mongodb.net/?retryWrites=true&w=majority&appName=little-lemon001'
).then(() => {
  console.log('Connected to little-lemon database');
}).catch((err) => {
  console.log(err);
});

// For backend and express
const express = require('express');
const https = require("https")
const fs = require("fs")
const api = express();
const cors = require("cors");
const { Fee } = require('../model/models');
const { string } = require('yup');
const feeConfig = require('../config/feeConfig');
console.log("App listen at port 5000");
api.use(express.json());
api.use(cors());
api.get("/", (req, resp) => {

    resp.send("App is Working");
    // Can check backend is working or not by
    // entering http://localhost:5000
    // If you see App is working means
    // backend working properly
});
//--------------------------------------------------------------------------------------------------//

//--------------------------------------------------------------------------------------------------//
// This route handler processes user registration requests for the '/register' path.


const createData = async () => {
    try {

        let feeDocument = await Fee.findOne();

        if (!feeDocument) {

            feeDocument = new Fee({
                fee: {
                    basic: 4.99,
                    premium: 7.99
                },
                discount1Dollar: 1,
                discount3Dollar: 3
            });
            await feeDocument.save();
            console.log('Fee data created successfully');
        } else {
            feeDocument.fee.basic = feeConfig.fee.basic;
            feeDocument.fee.premium = feeConfig.fee.premium;
            feeDocument.discount1Dollar = feeConfig.discount1Dollar;
            feeDocument.discount3Dollar = feeConfig.discount3Dollar;
            await feeDocument.save()
            console.log('Fee data already exists');
        }

        return feeDocument;
    } catch (e) {
        console.log('Error initializing fee data:', e);
        throw e;
    }
};

(async () => {
    createData();
})();

api.listen(5002, () => {
    console.log(`Fee server is running on http://localhost:5002`);
  });
//--------------------------------------------------------------------------------------------------//




module.exports = api;

