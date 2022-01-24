export type ConnectType = 'ble' | 'nfc';
export type OperateType = 'connect' | 'transfer' | 'complete';

export type HardwareConnectViewProps = {
  title: string;
  connectType: ConnectType;
  operateType?: OperateType;
};
