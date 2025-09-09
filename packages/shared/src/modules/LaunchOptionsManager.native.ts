import { NativeModules } from 'react-native';

interface ILaunchOptionsManagerInterface {
  getLaunchOptions(): Promise<Record<string, any> | null>;
  clearLaunchOptions(): Promise<boolean>;
}

const { LaunchOptionsManager } = NativeModules;

export default LaunchOptionsManager as ILaunchOptionsManagerInterface;
