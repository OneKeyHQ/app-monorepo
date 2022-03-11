import { ParamListBase } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createStackNavigator } from '@react-navigation/stack';
import { Platform } from 'react-native';

function createStack<T extends ParamListBase>() {
  const isWeb = Platform.OS === 'web';

  const stack = createStackNavigator<T>();
  const nativeStack = createNativeStackNavigator<T>();

  if (isWeb) return stack;
  return nativeStack;
}

export default createStack;
