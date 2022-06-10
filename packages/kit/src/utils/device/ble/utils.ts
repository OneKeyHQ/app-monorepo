/* eslint-disable */
// @ts-nocheck
/* eslint-disable @typescript-eslint/prefer-regexp-exec */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
import { Alert, Platform, PermissionsAndroid } from 'react-native';
import { BleManager, ScanMode, Device, BleError, State } from 'react-native-ble-plx';
import RNBleManager from 'react-native-ble-manager';

import { Buffer } from 'buffer';
import state from './state';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

const SERVICE_ID = '00000001-0000-1000-8000-00805f9b34fb';
const WRITE_NO_RESPONSE_ID = '00000002-0000-1000-8000-00805f9b34fb';
const NOTIFICATION_ID = '00000003-0000-1000-8000-00805f9b34fb';

const LENGTH_FILED_START_OFFSET = 10;
const LENGTH_FILED_END_OFFSET = 18;
const HEAD_LENGTH = 9;

class BleUtils {
  connectedDeviceType: IOneKeyDeviceType = 'classic';

  // 蓝牙是否连接
  isConnecting: boolean;

  manager: BleManager;

  peripheralId: string | undefined = '';

  constructor() {
    this.isConnecting = false;
  }

  async findConnectedDevices(): Promise<Device[]> {
    return this.manager.connectedDevices([SERVICE_ID]);
  }

  checkTransportState(): boolean {
    return RNBleManager.checkState();
  }

  async getManager(): Promise<BleManager> {
    if (this.manager) return Promise.resolve(this.manager);

    RNBleManager.start({ showAlert: true });

    const manager = new BleManager();
    return new Promise((resolve) => {
      const subscription = manager.onStateChange((managerState) => {
        // will catch error at connect process
        if (managerState !== State.Unknown) {
          this.manager = manager;
          subscription.remove();
          resolve(manager);
        }
      }, true);
    });
  }

  /**
   * 搜索蓝牙
   * */
  async startDeviceScan(
    listener: (device: Device | null | BleError) => void,
  ): Promise<void> {
    await this.checkPermission();

    const manager = await this.getManager();
    manager.startDeviceScan(
      null,
      {
        scanMode: ScanMode.LowLatency,
      },
      (error, device_1) => {
        if (error) {
          listener(error);
        } else {
          if (device_1) {
            listener(device_1);
          }
        }
      },
    );
  }

  /**
   * 停止搜索蓝牙
   * */
  async stopScan() {
    const manager = await this.getManager();
    manager.stopDeviceScan();
  }

  /**
   * 连接蓝牙
   * */
  async connect(id: string, deviceType: IOneKeyDeviceType) {

    const manager = await this.getManager();
    this.isConnecting = true;
    try {
      await this.checkPermission();
      const connected = await manager.isDeviceConnected(id);
      if (connected) {
        this.connectedDeviceType = deviceType;
        return;
      }
      const device = await manager.connectToDevice(id, {
        timeout: 3000,
        requestMTU: 512,
      });
      this.connectedDeviceType = deviceType;
      await device.discoverAllServicesAndCharacteristics();
      this.peripheralId = device.id;
      this.isConnecting = false;
      this.startNotification();
    } catch (err) {
      this.isConnecting = false;
      throw err;
    }
  }

  /**
   * 断开蓝牙
   * */
  async disconnect(deviceId: string) {
    const manager = await this.getManager();
    return manager.cancelDeviceConnection(deviceId);
  }

  async checkPermission() {
    if (Platform.OS === 'ios') {
      return;
    }
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Permission to access location was denied');
    }
  }

  /**
   * 写数据 withoutResponse
   * */
  async writeWithoutResponse(formatValue: string) {
    const manager = await this.getManager();
    const transactionId = 'writeWithoutResponse';
    return new Promise((resolve, reject) => {
      manager
        .writeCharacteristicWithoutResponseForDevice(
          this.peripheralId!,
          SERVICE_ID,
          WRITE_NO_RESPONSE_ID,
          formatValue,
          transactionId,
        )
        .then(
          (characteristic) => {
            resolve(characteristic);
          },
          (error) => {
            reject(error);
          },
        );
    });
  }

  async startNotification() {
    const transactionId = 'notification';
    const manager = await this.getManager();
    manager.monitorCharacteristicForDevice(
      this.peripheralId!,
      SERVICE_ID,
      NOTIFICATION_ID,
      (error, characteristic) => {
        if (error !== null) {
          return;
        }
        if (characteristic !== null && !!characteristic.value) {
          // TODO
          state.addBuffer(Buffer.from(characteristic.value, 'base64'));
        }
      },
      transactionId,
    );
  }

  /**
   * 卸载蓝牙管理器
   * */
  async destroy() {
    const manager = await this.getManager();
    manager.destroy();
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

const bleUtils = platformEnv.isNative ? new BleUtils() : null;

export default bleUtils;

export type BleDevice = Device;
