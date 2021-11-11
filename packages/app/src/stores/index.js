import BleDeviceStore from './BleDeviceStore';
import BleExchange from './BleExchange';

const bleDeviceStore = BleDeviceStore;
const bleExchange = new BleExchange();
// let bleDeviceStore = bleDeviceStore;

const stores = {
  bleDeviceStore,
  bleExchange,
};

export default stores;
