// For backend and express
const express = require('express');
const sharp = require('sharp');
const axios = require('axios');
const imgConverter = express();
const cors = require("cors");
require("dotenv").config()
const SECRET_KEY = process.env.SECRET_KEY;
const { string } = require('yup');
const { jwtDecode } = require('jwt-decode');
const { RefreshToken, User } = require('../model/models');
console.log("App listen at port 5000");

const corsOptions = {
	origin: 'http://localhost:3000', // Change to frontend's URL
	credentials: true, // Allow credentials (cookies, authorization headers, etc.)
};
imgConverter.use(cors(corsOptions));

imgConverter.use(express.json());
imgConverter.use((req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=604800');
  next();
});

imgConverter.get('/', async (req, res) => {
  const { url, w, auto } = req.query;

  if (!url) {
    return res.status(400).send('Missing image URL');
  }

  try {
    // 從遠程服務器獲取圖片
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'Cache-Control': 'max-age=604800'
      }
    });

    // 使用 sharp 進行圖片轉換
    let image = sharp(response.data);

    if (w) {
      const width = parseInt(w, 10);
      image = image.resize(width);
    }

    if (auto === 'webp') {
      image = image.webp();
    }

    const buffer = await image.toBuffer();

    // 設置正確的內容類型
    res.type(`image/${auto === 'webp' ? 'webp' : 'jpeg'}`);
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Cache-Control', 'public, max-age=604800')
    // 發送圖片
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while processing the image.');
  }
});

module.exports = imgConverter;
