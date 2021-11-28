import { createNativeStackNavigator } from '@react-navigation/native-stack';
// import { createStackNavigator } from '@react-navigation/stack';

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

export { StackNavigator };
