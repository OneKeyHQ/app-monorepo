import { useCallback, useMemo } from 'react';

import {
  Page,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
  useShare,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  EModalStakingRoutes,
  ETabEarnRoutes,
  IModalStakingParamList,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';
import { BorrowNavigation } from '../../borrowUtils';

import { DetailsPart } from './components/DetailsPart';
import { ManagePositionPart } from './components/ManagePositionPart';

const ReserveDetailsPage = () => {
  // Support both tab route and modal route
  const route = useAppRoute<
    ITabEarnParamList & IModalStakingParamList,
    | ETabEarnRoutes.BorrowReserveDetails
    | EModalStakingRoutes.BorrowReserveDetails
  >();
  const { gtMd } = useMedia();
  const { shareText } = useShare();
  const [devSettings] = useDevSettingsPersistAtom();

  const {
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    symbol,
    logoURI,
  } = route.params;

  const { earnAccount } = useEarnAccount({ networkId });
  const accountId = earnAccount?.account?.id || '';

  const shareUrl = useMemo(() => {
    if (!symbol || !provider || !networkId || !marketAddress || !reserveAddress)
      return undefined;
    return BorrowNavigation.generateBorrowShareLink({
      networkId,
      symbol,
      provider,
      marketAddress,
      reserveAddress,
      isDevMode: devSettings.enabled,
    });
  }, [
    symbol,
    provider,
    networkId,
    marketAddress,
    reserveAddress,
    devSettings.enabled,
  ]);

  const handleShare = useCallback(() => {
    if (!shareUrl) return;
    void shareText(shareUrl);
  }, [shareUrl, shareText]);

  // Native modal header: Token icon + Symbol
  const headerTitle = useCallback(
    () => (
      <XStack gap="$2" alignItems="center">
        <Token size="sm" tokenImageUri={logoURI} />
        <SizableText size="$headingLg" numberOfLines={1}>
          {symbol}
        </SizableText>
      </XStack>
    ),
    [symbol, logoURI],
  );

  return (
    <Page>
      <Page.Header headerTitle={headerTitle} headerRight={() => null} />
      <Page.Body>
        <ScrollView>
          <YStack py="$4" gap="$6">
            <XStack flexDirection={gtMd ? 'row' : 'column'}>
              <Stack w="100%" width={gtMd ? '65%' : undefined}>
                <DetailsPart
                  accountId={accountId}
                  networkId={networkId}
                  provider={provider}
                  marketAddress={marketAddress}
                  reserveAddress={reserveAddress}
                  symbol={symbol}
                  logoURI={logoURI}
                  onShare={handleShare}
                />
              </Stack>
              {gtMd ? (
                <Stack width="35%">
                  <ManagePositionPart
                    accountId={accountId}
                    networkId={networkId}
                    provider={provider}
                    marketAddress={marketAddress}
                    reserveAddress={reserveAddress}
                    symbol={symbol}
                    logoURI={logoURI}
                  />
                </Stack>
              ) : null}
            </XStack>
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
};

function ReserveDetailsPageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <ReserveDetailsPage />
    </AccountSelectorProviderMirror>
  );
}

export default ReserveDetailsPageWithProvider;
