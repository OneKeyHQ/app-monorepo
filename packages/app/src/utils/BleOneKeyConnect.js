const OneKeyConnect = require('@onekeyfe/connect');
const { Handler } = require('./BleHandler');

class BleOnekeyConnect {
  init = false;

  getConnect() {
    return Promise.resolve().then(() => {
      if (!this.init) {
        return OneKeyConnect.init({
          env: 'react-native',
          ble: Handler,
          debug: false,
        })
          .then(() => {
            this.init = true;
            console.log('OneKeyConnect 初始化成功');
            return OneKeyConnect;
          })
          .catch((err) => {
            console.error('OneKeyConnect 初始化失败', err);
          });
      }
      return OneKeyConnect;
    });
  }
}

export const bleOnekeyConnect = new BleOnekeyConnect();
