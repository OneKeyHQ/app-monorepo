import { useCallback, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Page, YStack } from '@onekeyhq/components';
import {
  type IPerpsDepositToken,
  usePerpsDepositTokensAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalPerpRoutes,
  IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';

import { mergePerpsDepositTokensPreservingOrder } from '../../../utils/depositWithdrawModalState';

import { DepositTokenSelectionContent } from './DepositWithdrawModal';

import type { RouteProp } from '@react-navigation/native';

function DepositSelectTokenModal() {
  const intl = useIntl();
  const navigation = useNavigation();
  const route =
    useRoute<
      RouteProp<IModalPerpParamList, EModalPerpRoutes.MobileDepositSelectToken>
    >();
  const [{ tokens }] = usePerpsDepositTokensAtom();
  const liveDepositTokens = useMemo(
    () => Object.values(tokens).flat(),
    [tokens],
  );
  const routeDepositTokens = route.params
    .depositTokensWithPrice as IPerpsDepositToken[];
  const depositTokensWithPrice = useMemo(() => {
    if (liveDepositTokens.length === 0) {
      return routeDepositTokens;
    }
    return mergePerpsDepositTokensPreservingOrder({
      currentTokens: routeDepositTokens,
      nextTokens: liveDepositTokens,
    });
  }, [liveDepositTokens, routeDepositTokens]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_select_crypto })}
      />
      <Page.Body>
        <YStack px="$4" flex={1}>
          <DepositTokenSelectionContent
            symbol={route.params.symbol}
            depositTokensWithPrice={depositTokensWithPrice}
            onClose={handleClose}
            hasLoaded
          />
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default DepositSelectTokenModal;
