// cspell: words unifold Unifold
import { useCallback, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  type IPageNavigationProp,
  NavBackButton,
  Page,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalPerpRoutes,
  type IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type {
  IUnifoldSupportedAsset,
  IUnifoldSupportedAssetChain,
} from '@onekeyhq/shared/types/unifoldDeposit';

import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../../PerpDialogLayout';

import { UnifoldTransferContent } from './UnifoldTransferContent';

import type { RouteProp } from '@react-navigation/core';

export default function MobileUnifoldDepositTransferModal() {
  const intl = useIntl();
  const navigation = useNavigation<IPageNavigationProp<IModalPerpParamList>>();
  const [detailExecutionId, setDetailExecutionId] = useState<string | null>(
    null,
  );
  const route =
    useRoute<
      RouteProp<
        IModalPerpParamList,
        EModalPerpRoutes.MobileUnifoldDepositTransfer
      >
    >();
  const initialSourceSelectorOpenedRef = useRef(false);
  const closeDetail = useCallback(() => {
    setDetailExecutionId(null);
  }, []);
  const renderDetailHeaderLeft = useCallback(
    () => <NavBackButton onPress={closeDetail} />,
    [closeDetail],
  );
  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  const renderBackHeaderLeft = useCallback(
    () => <NavBackButton onPress={goBack} />,
    [goBack],
  );
  const clearSourceSelectorResult = useCallback(() => {
    navigation.setParams({ sourceSelectorResult: undefined });
  }, [navigation]);
  const openInitialSourceSelector = useCallback(
    ({
      assets,
      asset,
      chain,
    }: {
      assets: IUnifoldSupportedAsset[];
      asset: IUnifoldSupportedAsset;
      chain: IUnifoldSupportedAssetChain;
    }) => {
      if (
        !route.params?.openSourceSelectorOnReady ||
        initialSourceSelectorOpenedRef.current
      ) {
        return;
      }
      initialSourceSelectorOpenedRef.current = true;
      navigation.setParams({ openSourceSelectorOnReady: undefined });
      navigation.push(EModalPerpRoutes.MobileUnifoldSourceSelector, {
        requestId: generateUUID(),
        mode: 'token',
        assets,
        selectedAssetSymbol: asset.symbol,
        selectedChainType: chain.chain_type,
        selectedChainId: chain.chain_id,
        continueToChain: true,
      });
    },
    [navigation, route.params?.openSourceSelectorOnReady],
  );

  return (
    <Page scrollEnabled safeAreaEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: detailExecutionId
            ? ETranslations.perp_unifold_deposit_details__title
            : ETranslations.perp_unifold_transfer_crypto__title,
        })}
        headerLeft={
          detailExecutionId ? renderDetailHeaderLeft : renderBackHeaderLeft
        }
      />
      <Page.Body px="$4" {...PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS}>
        {/* The page scrolls, so an absolute overlay would ride the content
            instead of the screen — the cards go in the page footer here. */}
        <UnifoldTransferContent
          expectedRecipient={route.params?.expectedRecipient}
          sourceSelectorResult={route.params?.sourceSelectorResult}
          onSourceSelectorResultHandled={clearSourceSelectorResult}
          onSourceSelectorReady={openInitialSourceSelector}
          statusCardsPlacement="pageFooter"
          useExternalHeader
          detailExecutionId={detailExecutionId}
          onDetailExecutionIdChange={setDetailExecutionId}
        />
      </Page.Body>
    </Page>
  );
}
