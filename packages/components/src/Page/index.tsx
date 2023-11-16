import { type PropsWithChildren, useMemo, useState } from 'react';

import { withStaticProperties } from 'tamagui';

import { BasicPage } from './BasicPage';
import { BasicPageFooter } from './BasicPageFooter';
import { PageContext } from './PageContext';
import { PageFooter } from './PageFooter';
import { PageHeader } from './PageHeader';

import type { IPageButtonGroupProps } from './PageButtonGroup';

function PageContainer({
  children,
  skipLoading,
}: PropsWithChildren<{ skipLoading: boolean }>) {
  return (
    <BasicPage skipLoading={skipLoading}>
      <>
        {children}
        {/* <Stack
          bg="$bg"
          padding="$5"
          $sm={{
            flexDirection: 'column',
            alignItems: 'center',
          }}
          $gtSm={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <PageButtonGroup />
        </Stack> */}
        <BasicPageFooter />
      </>
    </BasicPage>
  );
}

function PageProvider({
  children,
  skipLoading = false,
}: PropsWithChildren<{ skipLoading?: boolean }>) {
  const [options, setOptions] = useState<{
    footerOptions: IPageButtonGroupProps;
  }>();
  const value = useMemo(
    () => ({
      options,
      setOptions,
    }),
    [options],
  );
  return (
    <PageContext.Provider value={value}>
      <PageContainer skipLoading={skipLoading}>{children}</PageContainer>
    </PageContext.Provider>
  );
}

export const Page = withStaticProperties(PageProvider, {
  Header: PageHeader,
  Footer: PageFooter,
});
