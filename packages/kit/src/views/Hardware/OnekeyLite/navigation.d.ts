import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { OnekeyLiteModalRoutes, OnekeyLiteRoutesParams } from './routes';

export type OnekeyLiteStackNavigationProp = NativeStackNavigationProp<
  OnekeyLiteRoutesParams,
  OnekeyLiteModalRoutes
>;
