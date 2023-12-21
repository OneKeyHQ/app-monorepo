import type {
  Dispatch,
  MutableRefObject,
  ReactElement,
  RefObject,
  SetStateAction,
} from 'react';
import { createContext } from 'react';

import type { IScrollViewRef } from '../ScrollView';
import type { NativeScrollPoint } from 'react-native';

export interface IPageContentOptions {
  safeAreaEnabled?: boolean;
  footerElement?: ReactElement;
  scrollEnabled?: boolean;
  avoidHeight?: number;
  pageRef: RefObject<IScrollViewRef>;
  pageOffsetRef: MutableRefObject<NativeScrollPoint>;
}

interface IPageContentProps {
  options: IPageContentOptions;
  setOptions: Dispatch<SetStateAction<IPageContentOptions>>;
}

export const PageContext = createContext<IPageContentProps>(
  {} as IPageContentProps,
);
