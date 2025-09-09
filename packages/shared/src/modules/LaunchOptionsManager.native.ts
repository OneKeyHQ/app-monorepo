import { NativeModules } from 'react-native';

interface LaunchOptionsManagerInterface {
  getLaunchOptions(): Promise<Record<string, any> | null>;
  clearLaunchOptions(): Promise<boolean>;
}

const { LaunchOptionsManager } = NativeModules;

export default LaunchOptionsManager as LaunchOptionsManagerInterface;
