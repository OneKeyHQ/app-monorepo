import type { MutableRefObject, RefObject } from 'react';
import { createContext } from 'react';

import type { IPageFooterProps } from './type';
import type { IScrollViewRef } from '../ScrollView';
import type { NativeScrollPoint } from 'react-native';

export interface IPageFooterRef {
  props?: IPageFooterProps;
  notifyUpdate?: () => void;
}

export interface IPageContentOptions {
  safeAreaEnabled?: boolean;
  scrollEnabled?: boolean;
  pageRef: RefObject<IScrollViewRef>;
  pageOffsetRef: MutableRefObject<NativeScrollPoint>;
  footerRef: React.MutableRefObject<IPageFooterRef>;
}

type IPageContentProps = IPageContentOptions;

export const PageContext = createContext<IPageContentProps>(
  {} as IPageContentProps,
);
