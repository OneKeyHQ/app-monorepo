import { useMemo, useRef } from 'react';

import { withStaticProperties } from 'tamagui';

import { PageBody } from './PageBody';
import { PageClose } from './PageClose';
import { PageContainer } from './PageContainer';
import { PageContext } from './PageContext';
import { PageFooter } from './PageFooter';
import {
  FooterActions,
  FooterCancelButton,
  FooterConfirmButton,
} from './PageFooterActions';
import { PageHeader } from './PageHeader';

import type { IPageFooterRef } from './PageContext';
import type { IPageProps } from './type';
import type { IScrollViewRef } from '../ScrollView';
import type { NativeScrollPoint } from 'react-native';

export type { IPageProps, IPageFooterProps } from './type';

function PageProvider({
  children,
  skipLoading = false,
  scrollEnabled = false,
  scrollProps = { showsVerticalScrollIndicator: false },
  safeAreaEnabled = true,
}: IPageProps) {
  const pageRef = useRef<IScrollViewRef>(null);
  const pageOffsetRef = useRef<NativeScrollPoint>({
    x: 0,
    y: 0,
  });
  const footerRef = useRef<IPageFooterRef>({});
  const value = useMemo(
    () => ({
      scrollEnabled,
      scrollProps,
      safeAreaEnabled,
      pageRef,
      pageOffsetRef,
      footerRef,
    }),
    [safeAreaEnabled, scrollEnabled, scrollProps],
  );
  return (
    <PageContext.Provider value={value}>
      <PageContainer skipLoading={skipLoading}>{children}</PageContainer>
    </PageContext.Provider>
  );
}

export const Page = withStaticProperties(PageProvider, {
  Header: PageHeader,
  Body: PageBody,
  Footer: PageFooter,
  FooterActions,
  CancelButton: FooterCancelButton,
  ConfirmButton: FooterConfirmButton,
  Close: PageClose,
});

export * from './hooks';
