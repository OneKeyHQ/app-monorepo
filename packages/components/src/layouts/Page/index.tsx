import { useContext, useMemo, useState } from 'react';

import { withStaticProperties } from 'tamagui';

import { PageContextFooter } from './BasicPageFooter';
import { PageBody } from './PageBody';
import { PageClose } from './PageClose';
import { PageContainer } from './PageContainer';
import { PageContext } from './PageContext';
import { PageHeader } from './PageHeader';

import type { IPageButtonGroupProps } from './PageButtonGroup';
import type { IPageProps } from './type';

export type { IPageProps } from './type';

function PageProvider({
  children,
  skipLoading = false,
  safeAreaEnabled = false,
  scrollEnabled = false,
}: IPageProps) {
  const [options, setOptions] = useState<{
    footerOptions?: IPageButtonGroupProps;
    scrollEnabled?: boolean;
  }>({
    scrollEnabled,
  });
  const value = useMemo(
    () => ({
      options,
      setOptions,
    }),
    [options],
  );
  return (
    <PageContext.Provider value={value}>
      <PageContainer
        skipLoading={skipLoading}
        safeAreaEnabled={safeAreaEnabled}
      >
        {children}
      </PageContainer>
    </PageContext.Provider>
  );
}

export const usePageScrollEnabled = () => {
  const { options = {}, setOptions } = useContext(PageContext);
  return {
    scrollEnabled: options.scrollEnabled,
    changeScrollEnabled: (enabled: boolean) => {
      setOptions?.({
        ...options,
        scrollEnabled: enabled,
      });
    },
  };
};

export const Page = withStaticProperties(PageProvider, {
  Header: PageHeader,
  Body: PageBody,
  Footer: PageContextFooter,
  Close: PageClose,
});
