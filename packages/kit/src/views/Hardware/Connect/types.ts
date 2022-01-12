import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type ConnectType = 'ble' | 'nfc';
export type OperateType = 'connect' | 'transfer' | 'complete';

export type HardwareConnectViewProps = {
  title: string;
  connectType: ConnectType;
  operateType?: OperateType;
};

export type HardwareConnectStackNavigationProp = NativeStackNavigationProp<
  HardwareConnectRoutesParams,
  HardwareConnectModalRoutes
>;

export enum HardwareConnectModalRoutes {
  HardwareConnectModal = 'HardwareConnectModal',
}

export type HardwareConnectRoutesParams = {
  [HardwareConnectModalRoutes.HardwareConnectModal]: {
    defaultValues: HardwareConnectViewProps;
  };
};
