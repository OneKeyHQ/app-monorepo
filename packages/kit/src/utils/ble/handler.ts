/* eslint-disable */
// @ts-nocheck
import base64 from 'react-native-base64';
// import { when } from 'mobx';
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
    // console.log('enumerate ........+++');
    return Promise.resolve([{ path: 'ble', debug: false }]);
  },

  acquire(path) {
    return Promise.resolve().then(() => {
      console.log('acquire .........', path);
      state.acquire();
    });
  },

  release(path, debugLink, closePort) {
    return Promise.resolve().then(() => {
      console.log('release .........', path);
      state.release();
    });
  },

  write(_, __, data) {
    const newArray = new Uint8Array(64);
    // add ? at the beginning of the data
    newArray[0] = 63;
    newArray.set(new Uint8Array(data), 1);
    // encode data to base64 format
    const value = base64.encodeFromByteArray(newArray);

    return bleUtils.writeWithoutResponse(value).then(() => {
      // state.release();
    });
  },

  async read(path, debugLink) {
    console.log('read .........');
    // return mock features data
    // TODO: need a read function to retrieve the ble response
    await state.waitUtil((s) => !!s.isReadDone, 5);

    const data = state.getData().toString('hex');
    console.log('数据接收完毕', data);
    return Promise.resolve({ data });
    // return Promise.resolve({ data: '23230011000000f90a097472657a6f722e696f1001180920083218303242374346333535423733413630454642413338303032380140004a057a682d434e60016a142798aeac24ed2dff8babbc070df530ae404f44b17220b532d75a3c385d73ba58b82991e836d126eab45bb387100bc6b4f74805b09fb0800100980100aa010131d80100e00100f00101f00102f00105f00107f00108f0010af0010cf0010e9a0220d3bf2a5c8fef8bfd93068b9e075a0e065d6fb224496df3bb9a18a09ab6fa58ceaa1f054b33313436b21f05312e322e31b81f01c01f00d21f07312e302e302e34d81f00e21f05322e302e39ea1f10426978696e3230303630393030383230' });
  },
};

export default BLEHandler;
