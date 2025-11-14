//feeStore.js
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://c34klh:wiisport147@little-lemon001.sc2x5oo.mongodb.net/?retryWrites=true&w=majority&appName=little-lemon001'
).then(() => {
  console.log('Connected to little-lemon database');
}).catch((err) => {
  console.log(err);
});


const dotenv = require('dotenv');
const path = require('path');

// 1. 判斷當前環境
//    - process.env.NODE_ENV 會由您的 npm 腳本或部署環境來設定。
//    - 如果沒有設定，預設為 'development'。
const currentEnv = process.env.NODE_ENV || 'development';

// 2. 根據環境決定要載入的 .env 檔案名稱
const envFileName = `.env.${currentEnv}`;

console.log(`正在載入環境檔案: ${envFileName}`);

// 3. 載入指定的 .env 檔案
//    config() 會將檔案中的變數注入到 process.env 中
dotenv.config({
    path: path.resolve(__dirname,'..', envFileName)
});

// ----------------------------------------------------
// 在這裡之後，您就可以使用 process.env 來存取變數了
// ----------------------------------------------------

const port = process.env.PORT;
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS.split(',').map(url => url.trim());

// For backend and express
const express = require('express');
const https = require("https")
const fs = require("fs")
const api = express();
const cors = require("cors");
const { Fee } = require('../model/models');
const { string } = require('yup');
const feeConfig = require('../config/feeConfig');
api.use(express.json());
api.use(cors());
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

