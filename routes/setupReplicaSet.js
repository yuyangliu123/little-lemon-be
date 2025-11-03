const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 配置設定
const config = {
  mongoPath: 'C:\\Program Files\\MongoDB\\Server\\8.0',
  ports: [27017, 27018, 27019],
  replicaSetName: 'rs0',
  replicaSetConfig: {
    _id: 'rs0',
    members: [
      { _id: 0, host: 'localhost:27017', priority: 2 },
      { _id: 1, host: 'localhost:27018', priority: 1 },
      { _id: 2, host: 'localhost:27019', arbiterOnly: true }
    ]
  },
  startupWaitTime: 10000 // 等待 MongoDB 啟動的時間 (毫秒)
};

// 工具函數
class MongoHelper {
  static getMongoBinPath() {
    return path.join(config.mongoPath, 'bin');
  }

  static async executeMongoCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const mongosh = spawn(
        path.join('mongosh.exe'),
        [
          'mongodb://localhost:27017',
          '--quiet',
          '--eval',
          `try {
            ${command}
          } catch (e) {
            print(JSON.stringify({ error: e.message }));
          }`
        ]
      );

      let output = '';
      mongosh.stdout.on('data', (data) => {
        output += data.toString();
      });

      mongosh.stderr.on('data', (data) => {
        if (!options.silent) {
          console.error(`[mongosh ERROR] ${data}`);
        }
      });

      mongosh.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(output ? JSON.parse(output) : {});
          } catch (e) {
            resolve(output); // 返回原始輸出如果無法解析為 JSON
          }
        } else {
          reject(new Error(`mongosh exited with code ${code}`));
        }
      });
    });
  }

  // 新增方法：檢查並終止正在運行的 mongod 進程
  static async killExistingMongoProcesses() {
    return new Promise((resolve) => {
      console.log('檢查是否有正在運行的 mongod.exe 進程...');
      const tasklist = spawn('tasklist', ['/FI', 'IMAGENAME eq mongod.exe']);

      let output = '';
      tasklist.stdout.on('data', (data) => {
        output += data.toString();
      });

      tasklist.on('close', (code) => {
        if (code === 0 && output.includes('mongod.exe')) {
          console.log('發現正在運行的 mongod.exe 進程，正在終止...');
          const taskkill = spawn('taskkill', ['/F', '/IM', 'mongod.exe']);
          taskkill.on('close', (killCode) => {
            if (killCode === 0) {
              console.log('成功終止所有 mongod.exe 進程');
            } else {
              console.log('終止 mongod.exe 進程時遇到問題');
            }
            resolve();
          });
        } else {
          console.log('沒有發現正在運行的 mongod.exe 進程');
          resolve();
        }
      });
    });
  }
}

// 主流程類
class ReplicaSetManager {
  constructor() {
    this.mongoProcesses = [];
  }

  async setup() {
    try {
      // 0. 檢查並終止現有的 mongod 進程
      await MongoHelper.killExistingMongoProcesses();

      // 1. 創建數據目錄
      this.createDataDirs();

      // 2. 啟動 MongoDB 實例
      this.startMongoInstances();
      console.log(`已啟動 MongoDB 實例 (${config.ports.join(', ')})`);

      // 3. 等待實例啟動
      console.log(`等待 MongoDB 啟動 (${config.startupWaitTime / 1000}秒)...`);
      await new Promise(resolve => setTimeout(resolve, config.startupWaitTime));

      // 4. 初始化副本集
      await this.initReplicaSet();

      // 5. 檢查最終狀態
      await this.checkFinalStatus();

    } catch (error) {
      console.error('設定失敗:', error.message);
      this.cleanup();
      process.exit(1);
    }
  }

  createDataDirs() {
    config.ports.forEach(port => {
      const dir = path.join(config.mongoPath, port.toString());
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`已創建目錄: ${dir}`);
      }
    });
  }

  startMongoInstances() {
    this.mongoProcesses = config.ports.map(port => {
      const dbPath = path.join(config.mongoPath, port.toString());
      const args = [
        '--replSet', config.replicaSetName,
        '--port', port.toString(),
        '--dbpath', dbPath,
        '--bind_ip', 'localhost'
      ];

      const mongod = spawn(
        path.join(MongoHelper.getMongoBinPath(), 'mongod.exe'),
        args
      );

      mongod.stdout.on('data', (data) => {
        console.log(`[MongoDB ${port}] ${data}`);
      });

      mongod.stderr.on('data', (data) => {
        console.error(`[MongoDB ${port}] ERROR: ${data}`);
      });

      mongod.on('exit', (code) => {
        console.log(`[MongoDB ${port}] 進程退出，代碼: ${code}`);
      });

      return mongod;
    });
  }

  async initReplicaSet() {
    console.log('正在檢查副本集狀態...');
    const status = await this.checkReplicaSetStatus();

    if (status.initialized) {
      console.log('副本集已經初始化，當前狀態:');
      console.log(JSON.stringify(status.status, null, 2));
      return;
    }

    console.log('正在初始化副本集...');
    const result = await MongoHelper.executeMongoCommand(
      `rs.initiate(${JSON.stringify(config.replicaSetConfig)}); 
       print(JSON.stringify({ success: true }));`
    );

    if (result.error) {
      throw new Error(result.error);
    }

    console.log('等待副本集初始化完成...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  async checkReplicaSetStatus() {
    const result = await MongoHelper.executeMongoCommand(
      `const status = rs.status();
       print(JSON.stringify({
         initialized: status && status.ok === 1,
         status: status
       }));`
    );

    return result.error
      ? { initialized: false }
      : result;
  }

  async checkFinalStatus() {
    const status = await this.checkReplicaSetStatus();
    if (status.initialized) {
      console.log('副本集設定完成！最終狀態:');
      console.log(JSON.stringify(status.status, null, 2));
    } else {
      throw new Error('副本集初始化後檢查狀態失敗');
    }
  }

  cleanup() {
    this.mongoProcesses.forEach(process => {
      try {
        process.kill();
      } catch (e) {
        console.error('關閉進程時出錯:', e.message);
      }
    });
  }
}

// 啟動流程
const manager = new ReplicaSetManager();

// 處理 Ctrl+C 信號
process.on('SIGINT', () => {
  console.log('\n正在關閉 MongoDB 進程...');
  manager.cleanup();
  process.exit();
});

// 執行設定
manager.setup();