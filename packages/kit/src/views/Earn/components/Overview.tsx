import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  IconButton,
  NumberSizeableText,
  Popover,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
} from '../../../states/jotai/contexts/earn';
import { useAllNetworkId } from '../hooks/useAllNetworkId';
import { getNumberColor } from '../utils/getNumberColor';

export const Overview = ({
  isLoading,
  onRefresh,
}: {
  isLoading: boolean;
  onRefresh: () => void;
}) => {
  const media = useMedia();
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const actions = useEarnActions();
  const allNetworkId = useAllNetworkId();
  const totalFiatMapKey = useMemo(
    () =>
      actions.current.buildEarnAccountsKey({
        accountId: account?.id,
        indexAccountId: indexedAccount?.id,
        networkId: allNetworkId,
      }),
    [account?.id, actions, allNetworkId, indexedAccount?.id],
  );
  const [{ earnAccount }] = useEarnAtom();
  const [settings] = useSettingsPersistAtom();
  const totalFiatValue = useMemo(
    () => earnAccount?.[totalFiatMapKey]?.totalFiatValue || '0',
    [earnAccount, totalFiatMapKey],
  );
  const earnings24h = useMemo(
    () => earnAccount?.[totalFiatMapKey]?.earnings24h || '0',
    [earnAccount, totalFiatMapKey],
  );
  const hasClaimableAssets = useMemo(
    () => earnAccount?.[totalFiatMapKey]?.hasClaimableAssets || false,
    [earnAccount, totalFiatMapKey],
  );
  const isOverviewLoaded = useMemo(
    () => earnAccount?.[totalFiatMapKey]?.isOverviewLoaded || false,
    [earnAccount, totalFiatMapKey],
  );
  // const evmNetworkId = useMemo(() => getNetworkIdsMap().eth, []);
  // const shouldShowReferralBonus = useMemo(() => {
  //   return !!earnAccount?.[totalFiatMapKey]?.accounts.find(
  //     (item) => item.networkId === evmNetworkId,
  //   );
  // }, [earnAccount, totalFiatMapKey, evmNetworkId]);
  const navigation = useAppNavigation();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.InvestmentDetails,
    });
  }, [navigation]);
  const intl = useIntl();

  const handleRefresh = useCallback(() => {
    onRefresh();
    void backgroundApiProxy.serviceStaking.clearAvailableAssetsCache();
    actions.current.triggerRefresh();
  }, [onRefresh, actions]);

  return (
    <YStack
      gap="$1"
      px={media.gtSm ? '$5' : undefined}
      $gtLg={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        flex: 1,
        gap: '$8',
      }}
    >
      {/* total value */}
      <YStack gap="$1.5" flexShrink={1}>
        <SizableText
          size="$bodyLgMedium"
          $gtLg={{
            pl: '$0.5',
          }}
          pointerEvents="box-none"
        >
          {intl.formatMessage({ id: ETranslations.earn_total_staked_value })}
        </SizableText>
        <XStack gap="$3" ai="center">
          <NumberSizeableText
            size="$heading5xl"
            formatter="price"
            color={getNumberColor(totalFiatValue, '$text')}
            formatterOptions={{ currency: settings.currencyInfo.symbol }}
            numberOfLines={1}
            pointerEvents="box-none"
          >
            {totalFiatValue}
          </NumberSizeableText>
          {platformEnv.isNative ? null : (
            <IconButton
              icon="RefreshCcwOutline"
              variant="tertiary"
              loading={isLoading}
              onPress={handleRefresh}
            />
          )}
        </XStack>
      </YStack>
      {/* 24h earnings */}
      <XStack
        gap="$1.5"
        paddingRight="$24"
        flexShrink={1}
        $gtLg={{
          flexDirection: 'column-reverse',
        }}
      >
        <NumberSizeableText
          formatter="price"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
            showPlusMinusSigns: Number(earnings24h) !== 0,
          }}
          size="$bodyLgMedium"
          color={getNumberColor(earnings24h)}
          numberOfLines={1}
          $gtLg={{
            size: '$heading5xl',
          }}
          pointerEvents="box-none"
        >
          {earnings24h}
        </NumberSizeableText>
        <XStack gap="$1.5" alignItems="center">
          <SizableText
            size="$bodyLg"
            color="$textSubdued"
            $gtLg={{
              pl: '$0.5',
              color: '$text',
              size: '$bodyLgMedium',
            }}
            pointerEvents="box-none"
          >
            {intl.formatMessage({ id: ETranslations.earn_24h_earnings })}
          </SizableText>
          <Popover
            placement="bottom-start"
            renderTrigger={
              <IconButton
                variant="tertiary"
                size="small"
                icon="InfoCircleOutline"
              />
            }
            title={intl.formatMessage({
              id: ETranslations.earn_24h_earnings,
            })}
            renderContent={
              <SizableText px="$5" py="$4">
                {intl.formatMessage({
                  id: ETranslations.earn_24h_earnings_tooltip,
                })}
              </SizableText>
            }
          />
        </XStack>
      </XStack>

      {/* details button */}
      {!isOverviewLoaded ? null : (
        <Button
          childrenAsText={!hasClaimableAssets}
          onPress={onPress}
          variant="tertiary"
          iconAfter="ChevronRightOutline"
          position="absolute"
          jc="center"
          top={0}
          right={media.gtSm ? '$4' : '0'}
          $gtLg={{
            right: '$8',
            top: '$8',
          }}
        >
          {hasClaimableAssets ? (
            <Badge badgeType="info" badgeSize="sm" userSelect="none">
              <Badge.Text>
                {intl.formatMessage({ id: ETranslations.earn_claimable })}
              </Badge.Text>
            </Badge>
          ) : (
            intl.formatMessage({ id: ETranslations.global_details })
          )}
        </Button>
      )}
      {/* {shouldShowReferralBonus ? (
        <Button
          onPress={onPress}
          variant="tertiary"
          iconAfter="ChevronDownSmallOutline"
          position="absolute"
          jc="center"
          top={0}
          right="$4"
          $gtLg={{
            right: '$8',
            top: '$8',
          }}
        >
          {intl.formatMessage({ id: ETranslations.earn_referral_bonus })}
        </Button>
      ) : null} */}
    </YStack>
  );
};
