const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 設定圖片目錄
const directoryPath = path.join(__dirname, '../public/images');

// 讀取圖片目錄
fs.readdir(directoryPath, function (err, files) {
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    }

    // 遍歷所有檔案
    files.forEach(function (file) {
        // 檢查檔案是否為.jpg
        if (path.extname(file) === '.jpg') {
            // 創建webp版本
            sharp(directoryPath + '/' + file)
                .webp()
                .toFile(directoryPath + '/' + path.basename(file, '.jpg') + '.webp', (err, info) => {
                    if (err) {
                        console.log('Error during conversion: ', err);
                    } else {
                        console.log('File converted successfully: ', info);
                    }
                });
        }
    });
});
