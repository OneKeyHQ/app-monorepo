import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';

import { EarnAssetSearchContent } from '../../components/EarnAssetSearchPopover';

export default function EarnAssetSearchModal() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.EarnAssetSearch
  >();
  const { availableAssetsByType, initialCategoryType, onAssetSelect } =
    route.params;

  const handleAssetSelect = useCallback(
    (...args: Parameters<NonNullable<typeof onAssetSelect>>) => {
      onAssetSelect?.(...args);
      navigation.pop();
    },
    [navigation, onAssetSelect],
  );

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.earn_available_assets,
        })}
      />
      <Page.Body>
        <EarnAssetSearchContent
          availableAssetsByType={availableAssetsByType}
          initialCategoryType={initialCategoryType}
          onAssetSelect={handleAssetSelect}
        />
      </Page.Body>
    </Page>
  );
}
