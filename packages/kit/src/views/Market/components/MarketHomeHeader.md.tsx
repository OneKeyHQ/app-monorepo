import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page, SizableText, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketHomeHeaderSearchBar } from './MarketHomeHeaderSearchBar';

export function MarketHomeHeader() {
  const intl = useIntl();

  const renderLeft = useCallback(
    () => (
      <SizableText
        size="$headingLg"
        ml={platformEnv.isNativeIOS ? '$1' : undefined}
      >
        {intl.formatMessage({ id: 'title__market' })}
      </SizableText>
    ),
    [intl],
  );
  const renderHeaderRight = useCallback(() => null, []);
  return (
    <>
      <Page.Header
        title=""
        headerLeft={renderLeft}
        headerRight={renderHeaderRight}
      />
      <Stack px="$5" pb="$3">
        <MarketHomeHeaderSearchBar />
      </Stack>
    </>
  );
}
