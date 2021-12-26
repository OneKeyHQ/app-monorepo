import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from './routes';

const StackNavigator = createNativeStackNavigator<RootStackParamList>();

export { StackNavigator };
