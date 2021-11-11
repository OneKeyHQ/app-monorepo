/* eslint-disable */
// @ts-nocheck
/* eslint-disable @typescript-eslint/prefer-regexp-exec */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
import { Alert, Platform } from 'react-native';
import { BleManager, ScanMode, Device } from 'react-native-ble-plx';
import * as Location from 'expo-location';

import { Buffer } from 'buffer';
import state from './state';

const SERVICE_ID = '00000001-0000-1000-8000-00805f9b34fb';
const WRITE_NO_RESPONSE_ID = '00000002-0000-1000-8000-00805f9b34fb';
const NOTIFICATION_ID = '00000003-0000-1000-8000-00805f9b34fb';

const LENGTH_FILED_START_OFFSET = 10;
const LENGTH_FILED_END_OFFSET = 18;
const HEAD_LENGTH = 9;

class BleUtils {
  // 蓝牙是否连接
  isConnecting: boolean;

  manager: BleManager;

  peripheralId: string | undefined = 'BD193FF4-694A-C083-0A3E-224B1613E432';

  constructor() {
    this.isConnecting = false;
    this.manager = new BleManager();
  }

  findConnectedDevices() {
    return this.manager.connectedDevices([
      '00000003-0000-1000-8000-00805f9b34fb',
    ]);
  }

  /**
   * 搜索蓝牙
   * */
  startDeviceScan(listener: (device: Device | null) => void) {
    return Promise.resolve()
      .then(() => this.checkPermission())
      .then(() => {
        this.manager.startDeviceScan(
          null,
          {
            scanMode: ScanMode.LowLatency,
          },
          (error, device) => {
            if (error) {
              console.log('startDeviceScan error:', error);
              if (error.errorCode === 102) {
                this.alert('请打开手机蓝牙后再搜索');
              }
              throw error;
            } else {
              listener(device);
            }
          },
        );
      });
  }

  /**
   * 停止搜索蓝牙
   * */
  stopScan() {
    console.log('stopDeviceScan');
    this.manager.stopDeviceScan();
  }

  /**
   * 连接蓝牙
   * */
  async connect(id: string) {
    console.log('isConneting:', id);
    this.isConnecting = true;
    try {
      await this.checkPermission();
      const device = await this.manager.connectToDevice(id, {
        timeout: 3000,
        requestMTU: 512,
      });
      console.log('connect success:', device.name, device.id);
      await device.discoverAllServicesAndCharacteristics();
      this.peripheralId = device.id;
      this.isConnecting = false;
      this.startNotification();
    } catch (err) {
      this.isConnecting = false;
      console.log('connect fail: ', err);
    }
  }

  /**
   * 断开蓝牙
   * */
  async disconnect(deviceId: string) {
    await this.manager.cancelDeviceConnection(deviceId);
  }

  async checkPermission() {
    if (Platform.OS === 'ios') {
      return;
    }
    const permissionsStatus =
      await Location.requestForegroundPermissionsAsync();
    const { status } = permissionsStatus;
    if (status !== 'granted') {
      throw new Error('Permission to access location was denied');
    }
  }

  /**
   * 读取数据
   * */
  // read(index: number) {
  //   return new Promise((resolve, reject) => {
  //     this.manager
  //       .readCharacteristicForDevice(
  //         this.peripheralId!,
  //         this.readServiceUUID[index],
  //         this.readCharacteristicUUID[index],
  //       )
  //       .then(
  //         (characteristic) => {
  //           const buffer = Buffer.from(characteristic.value!, 'base64');
  //           // let value = buffer.toString();
  //           const value = this.byteToString(buffer);
  //           console.log('read success', buffer, value);
  //           resolve(value);
  //         },
  //         (error) => {
  //           console.log('read fail: ', error);
  //           if (error instanceof Error) {
  //             this.alert(`read fail: ${error.message}`);
  //           }
  //           reject(error);
  //         },
  //       );
  //   });
  // }

  // /**
  //  * 写数据
  //  * */
  // write(value: string, index: number) {
  //   const formatValue =
  //     value === '0D0A' ? value : Buffer.from(value, 'base64').toString('ascii');

  //   const transactionId = 'write';
  //   return new Promise((resolve, reject) => {
  //     this.manager
  //       .writeCharacteristicWithResponseForDevice(
  //         this.peripheralId!,
  //         this.writeWithResponseServiceUUID[index],
  //         this.writeWithResponseCharacteristicUUID[index],
  //         formatValue,
  //         transactionId,
  //       )
  //       .then(
  //         (characteristic) => {
  //           console.log('write success', value);
  //           resolve(characteristic);
  //         },
  //         (error) => {
  //           console.log('write fail: ', error);
  //           if (error instanceof Error) {
  //             this.alert(`write fail: ${error.message}`);
  //           }
  //           reject(error);
  //         },
  //       );
  //   });
  // }

  /**
   * 写数据 withoutResponse
   * */
  writeWithoutResponse(formatValue: string) {
    const transactionId = 'writeWithoutResponse';
    return new Promise((resolve, reject) => {
      this.manager
        .writeCharacteristicWithoutResponseForDevice(
          this.peripheralId!,
          SERVICE_ID,
          WRITE_NO_RESPONSE_ID,
          formatValue,
          transactionId,
        )
        .then(
          (characteristic) => {
            console.log('ble writeWithoutResponse success', formatValue);
            resolve(characteristic);
          },
          (error) => {
            console.log('ble writeWithoutResponse fail: ', error);
            if (error instanceof Error) {
              this.alert(`ble writeWithoutResponse fail: ${error.message}`);
            }
            reject(error);
          },
        );
    });
  }

  startNotification() {
    const transactionId = 'notification';
    this.manager.monitorCharacteristicForDevice(
      this.peripheralId!,
      SERVICE_ID,
      NOTIFICATION_ID,
      (error, characteristic) => {
        if (error !== null) {
          console.log('ble notication fail .........', error);
        }
        if (characteristic !== null && !!characteristic.value) {
          console.log(
            'ble notification receive data from characteristic.......',
            Buffer.from(characteristic.value, 'base64').toString('hex'),
          );

          // TODO
          state.addBuffer(Buffer.from(characteristic.value, 'base64'));
          console.log('----', state);
        }
      },
      transactionId,
    );
  }

  /**
   * 卸载蓝牙管理器
   * */
  destroy() {
    this.manager.destroy();
  }

  alert(text: string) {
    Alert.alert('提示', text, [{ text: '确定', onPress: () => {} }]);
  }

  /**
   * 字符串转换成byte数组
   */
  stringToByte(str: string) {
    const bytes = [];
    const len = str.length;
    let c;
    for (let i = 0; i < len; i++) {
      c = str.charCodeAt(i);
      if (c >= 0x010000 && c <= 0x10ffff) {
        bytes.push(((c >> 18) & 0x07) | 0xf0);
        bytes.push(((c >> 12) & 0x3f) | 0x80);
        bytes.push(((c >> 6) & 0x3f) | 0x80);
        bytes.push((c & 0x3f) | 0x80);
      } else if (c >= 0x000800 && c <= 0x00ffff) {
        bytes.push(((c >> 12) & 0x0f) | 0xe0);
        bytes.push(((c >> 6) & 0x3f) | 0x80);
        bytes.push((c & 0x3f) | 0x80);
      } else if (c >= 0x000080 && c <= 0x0007ff) {
        bytes.push(((c >> 6) & 0x1f) | 0xc0);
        bytes.push((c & 0x3f) | 0x80);
      } else {
        bytes.push(c & 0xff);
      }
    }
    return bytes;
  }

  /**
   * byte数组转换成字符串
   */
  byteToString(arr: Buffer) {
    if (typeof arr === 'string') {
      return arr;
    }
    let str = '';
    const _arr = arr;
    for (let i = 0; i < _arr.length; i++) {
      const one = _arr[i].toString(2);
      const v = one.match(/^1+?(?=0)/);
      if (v && one.length === 8) {
        const bytesLength = v[0].length;
        let store = _arr[i].toString(2).slice(7 - bytesLength);
        for (let st = 1; st < bytesLength; st++) {
          store += _arr[st + i].toString(2).slice(2);
        }
        str += String.fromCharCode(parseInt(store, 2));
        i += bytesLength - 1;
      } else {
        str += String.fromCharCode(_arr[i]);
      }
    }
    return str;
  }
}

const bleUtils = new BleUtils();

export default bleUtils;
