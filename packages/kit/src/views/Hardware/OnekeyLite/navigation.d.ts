import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  OnekeyLiteModalRoutes,
  OnekeyLitePinModalRoutes,
  OnekeyLitePinRoutesParams,
  OnekeyLiteRoutesParams,
} from './routes';

export type OnekeyLiteStackNavigationProp = NativeStackNavigationProp<
  OnekeyLiteRoutesParams,
  OnekeyLiteModalRoutes
>;

export type OnekeyLitePinStackNavigationProp = NativeStackNavigationProp<
  OnekeyLitePinRoutesParams,
  OnekeyLitePinModalRoutes
>;
