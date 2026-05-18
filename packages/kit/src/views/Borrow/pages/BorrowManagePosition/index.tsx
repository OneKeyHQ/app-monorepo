import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, Page, Skeleton, YStack, useMedia } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { BorrowNavigation } from '@onekeyhq/kit/src/views/Borrow/borrowUtils';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';
import { ManagePositionContent } from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';

const BorrowManagePosition = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.BorrowManagePosition
  >();

  const {
    accountId: routeAccountId,
    indexedAccountId: routeIndexedAccountId,
    networkId,
    symbol,
    provider,
    logoURI,
    providerLogoURI,
    reserveAddress,
    marketAddress,
    type,
  } = route.params;
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const { gtMd } = useMedia();
  const { earnAccount, isLoading: isAccountLoading } = useEarnAccount({
    networkId,
    accountId: routeAccountId,
    indexedAccountId: routeIndexedAccountId,
  });
  const accountId = earnAccount?.account?.id || routeAccountId || '';
  const indexedAccountId =
    earnAccount?.account?.indexedAccountId ?? routeIndexedAccountId;
  const hasReserveAddress = reserveAddress !== undefined;
  const defaultTab = useMemo(() => {
    if (type === 'withdraw' || type === 'repay') {
      return 'withdraw';
    }
    return 'deposit';
  }, [type]);
  const shouldWaitForAccount = Boolean(
    !earnAccount &&
    (routeAccountId || routeIndexedAccountId) &&
    isAccountLoading !== false,
  );
  const handleViewReserveDetails = useCallback(() => {
    if (!hasReserveAddress || !marketAddress) {
      return;
    }
    BorrowNavigation.pushToBorrowReserveDetails(appNavigation, {
      networkId,
      provider,
      marketAddress,
      reserveAddress,
      symbol,
      logoURI,
      isModal: true,
      accountId: accountId || undefined,
      indexedAccountId,
    });
  }, [
    appNavigation,
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    hasReserveAddress,
    symbol,
    logoURI,
    accountId,
    indexedAccountId,
  ]);

  const headerRight = useCallback(() => {
    if (gtMd || !hasReserveAddress || !marketAddress) {
      return null;
    }

    return (
      <Button
        testID="borrow-header-right-btn"
        variant="tertiary"
        // size="small"
        onPress={handleViewReserveDetails}
      >
        {intl.formatMessage({ id: ETranslations.defi_reserve_info })}
      </Button>
    );
  }, [gtMd, hasReserveAddress, marketAddress, handleViewReserveDetails, intl]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={
          symbol ||
          intl.formatMessage({ id: ETranslations.defi_manage_position })
        }
        headerRight={headerRight}
      />
      <Page.Body>
        {shouldWaitForAccount ? (
          <YStack px="$5" py="$4" gap="$4">
            <Skeleton h="$10" w="100%" borderRadius="$3" />
            <Skeleton h="$24" w="100%" borderRadius="$3" />
            <Skeleton h="$12" w="100%" borderRadius="$3" />
          </YStack>
        ) : (
          <ManagePositionContent
            showApyDetail
            isInModalContext
            networkId={networkId}
            symbol={symbol}
            provider={provider}
            accountId={accountId}
            indexedAccountId={indexedAccountId}
            fallbackTokenImageUri={logoURI}
            providerLogoUri={providerLogoURI}
            type={type}
            reserveAddress={reserveAddress}
            marketAddress={marketAddress}
            defaultTab={defaultTab}
          />
        )}
      </Page.Body>
    </Page>
  );
};

function BorrowManagePositionWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <DiscoveryBrowserProviderMirror>
          <BorrowManagePosition />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default BorrowManagePositionWithProvider;
