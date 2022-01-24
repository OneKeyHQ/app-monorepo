import { NativeModule } from 'react-native';

import {
  Callback as LiteCallback,
  CardInfo as LiteCardInfo,
} from '../hardware/OnekeyLite/types';

export interface OKLiteManagerInterface extends NativeModule {
  getCardName: (call: LiteCallback<string>) => void;
  getLiteInfo: (call: LiteCallback<LiteCardInfo>) => void;
  setMnemonic: (
    mnemonic: string,
    pwd: string,
    call: LiteCallback<boolean>,
  ) => void;
  getMnemonicWithPin: (pwd: string, call: LiteCallback<string>) => void;
  reset: (call: LiteCallback<boolean>) => void;
  cancel: () => void;
  intoSetting: () => void;
}

declare module 'react-native' {
  interface NativeModulesStatic {
    OKLiteManager: OKLiteManagerInterface;
  }
}
