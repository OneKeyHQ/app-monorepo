import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@onekeyhq/components/src/TabBar/Tab';

export type RootStackParamList = {
  Home: undefined;
  WebViewDemo: undefined;
  LiteDemo: undefined;
  BleDeviceDemo: undefined;
  AlertPage: undefined;
  PageProfileSample: { userId: string };
  PageFeedSample: { sort: 'latest' | 'top' } | undefined;
};

const StackNavigator = createNativeStackNavigator<RootStackParamList>();

const TabNavigator = createBottomTabNavigator();
export { StackNavigator, TabNavigator };
