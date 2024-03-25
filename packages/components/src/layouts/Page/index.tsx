import { useMemo, useRef } from 'react';

import { withStaticProperties } from 'tamagui';

import { PageBody } from './PageBody';
import { PageClose } from './PageClose';
import { PageContainer } from './PageContainer';
import { PageContext } from './PageContext';
import { Every, PageEvery } from './PageEvery';
import { PageFooter } from './PageFooter';
import {
  FooterActions,
  FooterCancelButton,
  FooterConfirmButton,
} from './PageFooterActions';
import { PageHeader } from './PageHeader';
import { PageLifeCycle } from './PageLifeCycle';

import type { IPageFooterRef } from './PageContext';
import type { IPageProps } from './type';
import type { IScrollViewRef } from '../ScrollView';
import type { NativeScrollPoint } from 'react-native';

export type { IPageProps, IPageFooterProps, IPageLifeCycle } from './type';

function PageProvider({
  children,
  skipLoading = false,
  scrollEnabled = false,
  scrollProps = { showsVerticalScrollIndicator: false },
  safeAreaEnabled = true,
  onMounted,
  onUnmounted,
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

  const isEnablePageLifeCycle = onMounted || onUnmounted;

  return (
    <>
      <PageContext.Provider value={value}>
        <PageContainer skipLoading={skipLoading}>{children}</PageContainer>
      </PageContext.Provider>
      {isEnablePageLifeCycle ? (
        <PageLifeCycle onMounted={onMounted} onUnmounted={onUnmounted} />
      ) : null}
      <PageEvery />
    </>
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
  Every,
});

export * from './hooks';
