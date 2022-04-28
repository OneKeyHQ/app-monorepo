import { when } from 'mobx';
import base64 from 'react-native-base64';

import state from './state';
import bleUtils from './utils';

export type OneKeyDeviceDebugInfo = {
  path: string;
  debug: boolean;
};

type BLEBridge = {
  enumerate(): Promise<OneKeyDeviceDebugInfo[]>;
  acquire(path: string, debugLink: boolean): Promise<void>;
  release(path: string, debugLink: boolean, closePort: boolean): Promise<void>;
  write(path: string, debugLink: boolean, data: Buffer): Promise<void>;
  read(path: string, debugLink: boolean): Promise<{ data: string }>;
};

const BLEHandler: BLEBridge = {
  enumerate() {
    // 列出设备列表, 可以通过 path 区分设备
    return Promise.resolve([{ path: 'ble', debug: false }]);
  },

  async acquire(path) {
    await Promise.resolve();
    console.log('acquire .........', path);
    state.acquire();
  },

  async release(path) {
    await Promise.resolve();
    console.log('release .........', path);
    state.release();
  },

  async write(_, __, data) {
    const newArray = new Uint8Array(64);
    // add ? at the beginning of the data
    newArray[0] = 63;
    newArray.set(new Uint8Array(data), 1);
    // encode data to base64 format
    const value = base64.encodeFromByteArray(newArray);
    if (bleUtils) await bleUtils.writeWithoutResponse(value);
  },

  async read() {
    console.log('read .........');

    await when(() => state.isReadDone);

    const data = state.getData().toString('hex');
    state.clearData();
    console.log('数据接收完毕', data);
    return Promise.resolve({ data });
  },
};

export default BLEHandler;
