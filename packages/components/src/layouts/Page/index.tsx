import { useMemo, useRef } from 'react';

import { withStaticProperties } from '@onekeyhq/components/src/shared/tamagui';

import { Portal } from '../../hocs';

import { PageBody } from './PageBody';
import { PageBackButton, PageClose, PageCloseButton } from './PageClose';
import { PageContainer } from './PageContainer';
import { PageContentContainer } from './PageContentContainer';
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

export type {
  IPageProps,
  IPageFooterProps,
  IPageLifeCycle,
  IPageContentContainerProps,
  IPageContentContainerLayout,
} from './type';

function PagePortal({ pagePortalId }: { pagePortalId: string }) {
  return pagePortalId ? <Portal.Container name={pagePortalId} /> : null;
}

function PageProvider({
  children,
  lazyLoad = false,
  scrollEnabled = false,
  scrollProps = { showsVerticalScrollIndicator: false },
  safeAreaEnabled = true,
  fullPage,
  onMounted,
  onUnmounted,
  onClose,
  onCancel,
  onConfirm,
  shouldRedirect,
  onRedirected,
}: IPageProps) {
  const footerRef = useRef<IPageFooterRef>({});
  const closeExtraRef = useRef<{ flag?: string }>({});

  const redirect = useMemo(() => !!shouldRedirect?.(), [shouldRedirect]);
  const pagePortalId = useMemo(() => {
    return Math.random().toString();
  }, []);
  const value = useMemo(
    () => ({
      scrollEnabled,
      scrollProps,
      safeAreaEnabled,
      footerRef,
      closeExtraRef,
      pagePortalId,
    }),
    [pagePortalId, safeAreaEnabled, scrollEnabled, scrollProps],
  );

  const isEnablePageLifeCycle =
    onMounted || onUnmounted || onClose || onCancel || onRedirected;

  return (
    <>
      {redirect ? null : (
        <PageContext.Provider value={value}>
          <>
            <PageContainer lazyLoad={lazyLoad} fullPage={fullPage}>
              {children}
            </PageContainer>
            <PagePortal pagePortalId={pagePortalId} />
          </>
        </PageContext.Provider>
      )}
      {isEnablePageLifeCycle ? (
        <PageLifeCycle
          shouldRedirect={shouldRedirect}
          onRedirected={onRedirected}
          onMounted={onMounted}
          onUnmounted={onUnmounted}
          onCancel={onCancel}
          onClose={onClose}
          onConfirm={onConfirm}
          closeExtraRef={closeExtraRef}
        />
      ) : null}
      <PageEvery />
    </>
  );
}

export const Page = withStaticProperties(PageProvider, {
  Header: PageHeader,
  Body: PageBody,
  Footer: PageFooter,
  Container: PageContentContainer,
  FooterActions,
  CancelButton: FooterCancelButton,
  ConfirmButton: FooterConfirmButton,
  Close: PageClose,
  CloseButton: PageCloseButton,
  BackButton: PageBackButton,
  Every,
});

export * from './hooks';

export * from './iPadModalPageContext';
