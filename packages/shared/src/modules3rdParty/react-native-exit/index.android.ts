import { NativeModules } from 'react-native';

const { ExitModule } = NativeModules as {
  ExitModule: {
    exitApp: () => void;
  };
};

export const exitApp = () => {
  ExitModule.exitApp();
};
