/* eslint-disable import/no-cycle */
/* eslint-disable no-param-reassign */
/* eslint-disable no-async-promise-executor */
import {
  action,
  autorun,
  configure,
  makeObservable,
  observable,
  runInAction,
} from 'mobx';
import { Device } from 'react-native-ble-plx';

import isOnekeyDevice from '@onekeyhq/kit/src/utils/ble/OnekeyHardware';

import bleUtils from './utils';

let scanTimer: any = null;

configure({
  enforceActions: 'never',
});

class BleDeviceStore {
  isScaning = false;

  isConnecting = false;

  connectedDeviceMap = new Map<string, Device>();

  findedDeviceMap = new Map<string, Device>();

  connectedDevices: Device[] = [];

  findedDevices: Device[] = [];

  constructor() {
    makeObservable(this, {
      isScaning: observable,
      isConnecting: observable,
      connectedDeviceMap: observable,
      findedDeviceMap: observable,
      connectedDevices: observable,
      findedDevices: observable,
      initConnectedDevices: action.bound,
      scanDevices: action.bound,
      stopScanDevices: action.bound,
      connect: action.bound,
      disconnect: action.bound,
    });
    this.initConnectedDevices();

    autorun(() => {
      this.connectedDevices = Array.from(this.connectedDeviceMap.values());
    });

    autorun(() => {
      this.findedDevices = Array.from(this.findedDeviceMap.values());
    });
  }

  initConnectedDevices() {
    console.log('查找已经连接过的设备');
    bleUtils
      ?.findConnectedDevices()
      .then((devices) => {
        console.log('已经连接的设备');
        console.log(JSON.stringify(devices));
        devices.forEach((device) => {
          console.log('已经连接的设备: ', device.id, device.name);
          if (isOnekeyDevice(device.name)) {
            // @ts-ignore
            device.connceted = true;
            this.connectedDeviceMap.set(device.id, device);
          }
        });
      })
      .catch((error) => {
        console.log(error);
      });
  }

  async isConnected(deviceId: string): Promise<boolean> {
    const exists = this.connectedDeviceMap.has(deviceId);
    const connected = await this.connectedDeviceMap
      .get(deviceId)
      ?.isConnected();
    return exists && (connected as boolean);
  }

  scanDevices(searchTime = 10) {
    console.log('开始搜索蓝牙');

    runInAction(() => {
      this.stopScanDevices();
      this.isScaning = true;
      this.findedDeviceMap.clear();
    });

    try {
      bleUtils?.startDeviceScan((device) => {
        if (device && isOnekeyDevice(device.name)) {
          const exists = this.findedDeviceMap.has(device.id);
          if (!exists) {
            runInAction(() => {
              // 使用Map类型保存搜索到的蓝牙设备，确保列表不显示重复的设备
              this.findedDeviceMap.set(device?.id ?? '', device);
              console.log(device.id, device.name);
            });
          }
        }
      });

      if (searchTime && searchTime !== 0) {
        if (scanTimer) clearTimeout(scanTimer);
        scanTimer = setTimeout(() => {
          this.stopScanDevices();
        }, searchTime * 1000);
        // 10 秒后停止搜索
      }
    } catch (error) {
      runInAction(() => {
        // @ts-ignore
        this.scaning = false;
      });

      console.log('startDeviceScan error:', error);
    }
  }

  stopScanDevices() {
    if (this.isScaning === true) {
      bleUtils?.stopScan();
      runInAction(() => {
        this.isScaning = false;
        console.log('停止蓝牙搜索');
      });
    }
  }

  async connect(device: Device) {
    if (this.isScaning) {
      // 连接的时候正在扫描，先停止扫描
      this.stopScanDevices();
    }
    const connected = await this.isConnected(device.id);
    if (connected) {
      console.log(device.id, '已经连接');
      return;
    }

    if (this.isConnecting) {
      console.log('有设备正在连接');
      return;
    }
    runInAction(() => {
      // @ts-ignore
      device.connecting = true;
      this.isConnecting = true;
    });
    try {
      await bleUtils?.connect(device.id, 'classic');
      runInAction(() => {
        console.log('连接成功');
        // @ts-ignore
        device.connected = true;
        this.connectedDeviceMap.set(device.id, device);
        this.onDeviceDisconnect(device.id);
      });
    } catch (error) {
      runInAction(() => {
        // @ts-ignore
        device.connected = false;
        this.isConnecting = false;
      });
    }
  }

  disconnect(device: Device) {
    bleUtils?.disconnect(device.id).then(() => {
      this.connectedDeviceMap.delete(device.id);
    });
  }

  onDeviceDisconnect(peripheralId: string) {
    bleUtils?.manager.onDeviceDisconnected(peripheralId, (error, device) => {
      runInAction(() => {
        this.connectedDeviceMap.delete(peripheralId);
      });
      if (error || !device) {
        // 蓝牙遇到错误自动断开
        console.log('onDeviceDisconnected', 'device disconnect', error);
      } else {
        console.log(
          'onDeviceDisconnected',
          'device disconnect',
          device.id,
          device.name,
        );
      }
    });
  }
}

const bleDeviceStore = new BleDeviceStore();

export default bleDeviceStore;
