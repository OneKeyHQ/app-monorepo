import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HeaderLeft } from '../../../components/TabPageHeader/HeaderLeft';

import { MarketHomeHeaderSearchBar } from './MarketHomeHeaderSearchBar';

export function MarketHomeHeader() {
  const intl = useIntl();
  const renderHeaderLeft = useCallback(
    () => <HeaderLeft sceneName={EAccountSelectorSceneName.home} />,
    [],
  );
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
      headerLeft={renderHeaderLeft}
      headerRight={renderHeaderRight}
    />
  );
}
