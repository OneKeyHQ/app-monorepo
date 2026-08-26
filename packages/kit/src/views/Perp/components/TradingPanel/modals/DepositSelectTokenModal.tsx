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

import {
  getPerpsDepositTokenDisplayList,
  mergePerpsDepositTokensPreservingOrder,
  shouldUsePerpsDepositLiveWalletTokens,
} from './depositTokenDisplayUtils';
import { DepositTokenSelectionContent } from './DepositTokenSelectionContent';

import type { RouteProp } from '@react-navigation/native';

function DepositSelectTokenModal() {
  const intl = useIntl();
  const navigation = useNavigation();
  const route =
    useRoute<
      RouteProp<IModalPerpParamList, EModalPerpRoutes.MobileDepositSelectToken>
    >();
  const [{ tokens, depositTokenListOwnerKey, depositTokenListSource }] =
    usePerpsDepositTokensAtom();
  const routeDepositTokenListOwnerKey = route.params.depositTokenListOwnerKey;
  const hasRouteDepositTokens = Array.isArray(
    route.params.depositTokensWithPrice,
  );
  const routeDepositTokens = useMemo(
    () => (route.params.depositTokensWithPrice ?? []) as IPerpsDepositToken[],
    [route.params.depositTokensWithPrice],
  );
  const atomDepositTokens = useMemo(
    () => getPerpsDepositTokenDisplayList(tokens),
    [tokens],
  );
  const liveDepositTokens = useMemo(() => {
    if (
      !shouldUsePerpsDepositLiveWalletTokens({
        atomOwnerKey: depositTokenListOwnerKey,
        routeOwnerKey: routeDepositTokenListOwnerKey,
        depositTokenListSource,
      })
    ) {
      return [];
    }
    return atomDepositTokens;
  }, [
    atomDepositTokens,
    depositTokenListOwnerKey,
    depositTokenListSource,
    routeDepositTokenListOwnerKey,
  ]);
  const depositTokensWithPrice = useMemo(() => {
    if (!hasRouteDepositTokens) {
      return atomDepositTokens;
    }
    if (liveDepositTokens.length === 0) {
      return routeDepositTokens;
    }
    return mergePerpsDepositTokensPreservingOrder({
      currentTokens: routeDepositTokens,
      nextTokens: liveDepositTokens,
    });
  }, [
    atomDepositTokens,
    hasRouteDepositTokens,
    liveDepositTokens,
    routeDepositTokens,
  ]);
  const hasLoadedDepositTokenBalances =
    route.params.hasLoadedDepositTokenBalances ??
    (hasRouteDepositTokens ? true : atomDepositTokens.length > 0);

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
            hasLoaded={hasLoadedDepositTokenBalances}
          />
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default DepositSelectTokenModal;
