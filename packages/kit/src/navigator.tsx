import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { createBottomTabNavigator } from '@onekeyhq/components/src/TabBar/Tab';

import { RootStackParamList } from './routes';

const StackNavigator = createNativeStackNavigator<RootStackParamList>();

const TabNavigator = createBottomTabNavigator();
export { StackNavigator, TabNavigator };
