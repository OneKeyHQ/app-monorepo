import { Alert, Platform } from 'react-native';
import { BleManager, ScanCallbackType, ScanMode } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import * as Location from 'expo-location';
import stores from '../stores';

SERVICE_ID = '00000001-0000-1000-8000-00805f9b34fb';
WRITE_NO_RESPONSE_ID = '00000002-0000-1000-8000-00805f9b34fb';
NOTIFICATION_ID = '00000003-0000-1000-8000-00805f9b34fb';

LENGTH_FILED_START_OFFSET = 10;
LENGTH_FILED_END_OFFSET = 18;
HEAD_LENGTH = 9;
class BleUtils {
  constructor() {
    this.isConnecting = false; //蓝牙是否连接
    this.manager = new BleManager();
  }

  async findConnectedDevices() {
    return this.manager.connectedDevices([
      '00000003-0000-1000-8000-00805f9b34fb',
    ]);
  }

  /**
   * 搜索蓝牙
   * */
  startDeviceScan(listener) {
    Promise.resolve()
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
              if (error.errorCode == 102) {
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
    this.manager.stopDeviceScan();
    console.log('stopDeviceScan');
  }

  /**
   * 连接蓝牙
   * */
  async connect(id) {
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
  async disconnect(deviceId) {
    await this.manager.cancelDeviceConnection(deviceId);
  }

  async checkPermission() {
    if (Platform.OS == 'ios') {
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
  read(index) {
    return new Promise((resolve, reject) => {
      this.manager
        .readCharacteristicForDevice(
          this.peripheralId,
          this.readServiceUUID[index],
          this.readCharacteristicUUID[index],
        )
        .then(
          (characteristic) => {
            let buffer = Buffer.from(characteristic.value, 'base64');
            // let value = buffer.toString();
            const value = this.byteToString(buffer);
            console.log('read success', buffer, value);
            resolve(value);
          },
          (error) => {
            console.log('read fail: ', error);
            this.alert('read fail: ' + error.reason);
            reject(error);
          },
        );
    });
  }

  /**
   * 写数据
   * */
  write(value, index) {
    let formatValue;
    if (value === '0D0A') {
      formatValue = value;
    } else {
      formatValue = new Buffer(value, 'base64').toString('ascii');
    }
    let transactionId = 'write';
    return new Promise((resolve, reject) => {
      this.manager
        .writeCharacteristicWithResponseForDevice(
          this.peripheralId,
          this.writeWithResponseServiceUUID[index],
          this.writeWithResponseCharacteristicUUID[index],
          formatValue,
          transactionId,
        )
        .then(
          (characteristic) => {
            console.log('write success', value);
            resolve(characteristic);
          },
          (error) => {
            console.log('write fail: ', error);
            this.alert('write fail: ', error.reason);
            reject(error);
          },
        );
    });
  }

  /**
   * 写数据 withoutResponse
   * */
  writeWithoutResponse(value) {
    let formatValue = value;
    // if (value === "0D0A") {
    //   //直接发送小票打印机的结束标志
    //   formatValue = value;
    // } else {
    //   //发送内容，转换成base64编码
    //   // formatValue = new Buffer(value, "base64");
    //   formatValue = value;

    // }
    let transactionId = 'writeWithoutResponse';
    return new Promise((resolve, reject) => {
      this.manager
        .writeCharacteristicWithoutResponseForDevice(
          this.peripheralId,
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
            this.alert('ble writeWithoutResponse fail: ', error.reason);
            reject(error);
          },
        );
    });
  }

  startNotification() {
    let transactionId = 'notification';
    this.manager.monitorCharacteristicForDevice(
      this.peripheralId,
      SERVICE_ID,
      NOTIFICATION_ID,
      (error, characteristic) => {
        if (error !== null) {
          console.log('ble notication fail .........', error);
        }
        if (characteristic !== null) {
          console.log(
            'ble notification receive data from characteristic.......',
            Buffer.from(characteristic.value, 'base64').toString('hex'),
          );

          stores.bleExchange.addBuffer(
            Buffer.from(characteristic.value, 'base64'),
          );
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

  alert(text) {
    Alert.alert('提示', text, [{ text: '确定', onPress: () => {} }]);
  }

  /**
   * 字符串转换成byte数组
   */
  stringToByte(str) {
    var bytes = new Array();
    var len, c;
    len = str.length;
    for (var i = 0; i < len; i++) {
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
  byteToString(arr) {
    if (typeof arr === 'string') {
      return arr;
    }
    var str = '',
      _arr = arr;
    for (var i = 0; i < _arr.length; i++) {
      var one = _arr[i].toString(2),
        v = one.match(/^1+?(?=0)/);
      if (v && one.length == 8) {
        var bytesLength = v[0].length;
        var store = _arr[i].toString(2).slice(7 - bytesLength);
        for (var st = 1; st < bytesLength; st++) {
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
