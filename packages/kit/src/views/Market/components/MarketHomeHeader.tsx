import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page, Stack } from '@onekeyhq/components';

import { MarketHomeHeaderSearchBar } from './MarketHomeHeaderSearchBar';

export function MarketHomeHeader() {
  const intl = useIntl();
  const renderHeaderLeft = useCallback(() => null, []);
  const renderHeaderRight = useCallback(
    () => (
      <Stack width={280}>
        <MarketHomeHeaderSearchBar size="small" />
      </Stack>
    ),
    [],
  );
  return (
    <Page.Header
      title={intl.formatMessage({ id: 'title__market' })}
      headerLeft={renderHeaderLeft}
      headerRight={renderHeaderRight}
    />
  );
}
