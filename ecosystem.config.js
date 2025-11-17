// ecosystem.config.js
module.exports = {
  apps : [
      {
        name: "little-lemon-api",
        script: "./server.js",
        // 在 PM2 配置中明確設定環境變數
        env: {
          NODE_ENV: "production",
        },
        // 額外指定要載入的 .env 檔案 (可選)
        // PM2 會自動使用 NODE_ENV 載入對應的 .env 檔案
        env_production: {
          NODE_ENV: "production"
        }
      }
  ]
};