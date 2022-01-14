import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type HardwarePinCodeStackNavigationProp = NativeStackNavigationProp<
  HardwarePinCodeRoutesParams,
  HardwarePinCodeModalRoutes
>;

export enum HardwarePinCodeModalRoutes {
  HardwarePinCodeModal = 'HardwarePinCodeModal',
}

export type HardwarePinCodeRoutesParams = {
  [HardwarePinCodeModalRoutes.HardwarePinCodeModal]: {
    defaultValues: { title?: string; description?: string };
  };
};
