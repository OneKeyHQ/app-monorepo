import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ModalTypes } from '../../../routes';

import {
  OnekeyLiteChangePinModalRoutes,
  OnekeyLiteChangePinRoutesParams,
  OnekeyLiteModalRoutes,
  OnekeyLiteResetModalRoutes,
  OnekeyLiteResetRoutesParams,
} from './routes';

export type OnekeyLiteStackNavigationProp = NativeStackNavigationProp<
  ModalTypes,
  OnekeyLiteModalRoutes
>;

export type OnekeyLiteResetStackNavigationProp = NativeStackNavigationProp<
  OnekeyLiteResetRoutesParams,
  OnekeyLiteResetModalRoutes
>;

export type OnekeyLiteChangePinStackNavigationProp = NativeStackNavigationProp<
  OnekeyLiteChangePinRoutesParams,
  OnekeyLiteChangePinModalRoutes
>;
