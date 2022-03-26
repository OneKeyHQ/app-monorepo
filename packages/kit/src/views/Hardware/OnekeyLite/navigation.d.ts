import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  OnekeyLiteChangePinModalRoutes,
  OnekeyLiteChangePinRoutesParams,
  OnekeyLiteResetModalRoutes,
  OnekeyLiteResetRoutesParams,
} from './routes';

export type OnekeyLiteResetStackNavigationProp = NativeStackNavigationProp<
  OnekeyLiteResetRoutesParams,
  OnekeyLiteResetModalRoutes
>;

export type OnekeyLiteChangePinStackNavigationProp = NativeStackNavigationProp<
  OnekeyLiteChangePinRoutesParams,
  OnekeyLiteChangePinModalRoutes
>;
