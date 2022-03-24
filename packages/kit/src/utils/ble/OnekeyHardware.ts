import { Device } from 'react-native-ble-plx';

const isOnekeyDevice = (device: Device): boolean => {
  // 过滤 BixinKeyxxx 和 Kxxxx

  // i 忽略大小写模式
  const re = /(BixinKey\d{10})|(K\d{4})/i;
  if (device && device.name && re.exec(device.name)) {
    return true;
  }
  return false;
};

export { isOnekeyDevice as default };
