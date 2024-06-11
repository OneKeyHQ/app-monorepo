import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketHomeHeaderSearchBar } from './MarketHomeHeaderSearchBar';

export function MarketHomeHeader() {
  const intl = useIntl();
  const renderHeaderLeft = useCallback(() => null, []);
  const renderHeaderRight = useCallback(
    () => (
      <Stack width={280}>
        <MarketHomeHeaderSearchBar />
      </Stack>
    ),
    [],
  );
  return (
    <Page.Header
      title={intl.formatMessage({ id: ETranslations.global_market })}
      headerLeft={renderHeaderLeft}
      headerRight={renderHeaderRight}
    />
  );
}
