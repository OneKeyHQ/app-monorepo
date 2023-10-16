/* eslint-disable @typescript-eslint/no-unused-vars */

import type {
  ButtonProps,
  IsPackageInstalledResult,
  ShareSingleOptions,
} from 'react-native-share';
import type RNShare from 'react-native-share';
import type { ShareSingleResult } from 'react-native-share/lib/typescript/types';

const mock: typeof RNShare = {
  open(o: any) {
    throw new Error('Function not implemented.');
  },
  Button({
    buttonStyle,
    onPress,
    iconSrc,
    textStyle,
    children,
  }: ButtonProps): JSX.Element {
    throw new Error('Function not implemented.');
  },
  ShareSheet: undefined as any,
  Overlay: undefined as any,
  Sheet: undefined as any,
  Social: undefined as any,
  shareSingle(options: ShareSingleOptions): Promise<ShareSingleResult> {
    throw new Error('Function not implemented.');
  },
  isPackageInstalled(packageName: string): Promise<IsPackageInstalledResult> {
    throw new Error('Function not implemented.');
  },
};

// only native modules available, please check index.native.ts
export default mock;
