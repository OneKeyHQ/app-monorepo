import type { MutableRefObject } from 'react';
import { createContext, useContext } from 'react';

import type { IPageFooterProps } from './type';
import type { IScrollViewProps } from '../ScrollView';

export interface IPageFooterRef {
  props?: IPageFooterProps;
  notifyUpdate?: () => void;
}

export interface IPageContentOptions {
  pagePortalId?: string;
  safeAreaEnabled?: boolean;
  scrollEnabled?: boolean;
  footerRef: MutableRefObject<IPageFooterRef>;
  scrollProps?: Omit<IScrollViewProps, 'children'>;
  closeExtraRef?: MutableRefObject<{ flag?: string }>;
}

type IPageContentProps = IPageContentOptions;

export const PageContext = createContext<IPageContentProps>(
  {} as IPageContentProps,
);

export const usePageContext = () => {
  const context = useContext(PageContext);

  return context || ({} as IPageContentOptions);
};
