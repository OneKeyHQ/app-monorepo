import { type PropsWithChildren, useMemo, useState } from 'react';

import { withStaticProperties } from 'tamagui';

import { Stack } from '../Stack';

import { BasicPage } from './BasicPage';
import { PageButtonGroup } from './PageButtonGroup';
import { PageContext } from './PageContext';
import { PageFooter } from './PageFooter';
import { PageHeader } from './PageHeader';

import type { IPageButtonGroupProps } from './PageButtonGroup';
import { BasicPageFooter } from './BasicPageFooter';

function PageContainer({ children }: PropsWithChildren<unknown>) {
  return (
    <BasicPage>
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

function PageProvider({ children }: PropsWithChildren<unknown>) {
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
      <PageContainer>{children}</PageContainer>
    </PageContext.Provider>
  );
}

export const Page = withStaticProperties(PageProvider, {
  Header: PageHeader,
  Footer: PageFooter,
});
