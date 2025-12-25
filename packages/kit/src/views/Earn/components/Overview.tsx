import { memo, useCallback, useMemo, useState } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  IconButton,
  NumberSizeableText,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import type {
  IEarnAlert,
  IEarnSummaryV2,
} from '@onekeyhq/shared/types/staking';

import { ListItem } from '../../../components/ListItem';
import { Token } from '../../../components/Token';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useEarnAtom } from '../../../states/jotai/contexts/earn';
import { EarnActionIcon } from '../../Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { useEarnAccountKey } from '../hooks/useEarnAccountKey';
import { getNumberColor } from '../utils/getNumberColor';

const Rebate = ({
  rebateData,
  handleHistoryPress,
}: {
  rebateData?: IEarnSummaryV2;
  handleHistoryPress: () => void;
}) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);

  const handleHistoryClick = useCallback(() => {
    setOpen(false);
    handleHistoryPress();
  }, [handleHistoryPress]);

  const itemRender = useCallback(
    ({
      children,
      key,
      needDivider,
    }: {
      children: React.ReactNode;
      key: string | number;
      needDivider?: boolean;
    }) => {
      return (
        <>
          <ListItem
            my="$2"
            key={key}
            ai="center"
            jc="space-between"
            borderWidth="$0"
          >
            {children}
          </ListItem>
          {needDivider ? <Divider mx="$5" my="$2.5" /> : null}
        </>
      );
    },
    [],
  );

  if (
    !rebateData ||
    (isEmpty(rebateData?.distributed) && isEmpty(rebateData?.undistributed))
  ) {
    return null;
  }

  return (
    <XStack
      flex={1}
      jc="flex-end"
      mb="auto"
      position="absolute"
      right={0}
      top={0}
    >
      <Popover
        open={open}
        onOpenChange={setOpen}
        placement="bottom-end"
        renderTrigger={
          <XStack cursor="pointer" ai="center">
            <EarnText
              size="$bodySmMedium"
              color="$textSubdued"
              text={rebateData?.title}
            />
            <Icon
              size="$bodySmMedium"
              name="ChevronDownSmallOutline"
              color="$iconSubdued"
            />
          </XStack>
        }
        title={intl.formatMessage({ id: ETranslations.earn_referral_bonus })}
        renderContent={
          <YStack mt="$2.5" overflow="hidden" borderRadius="$3">
            {isEmpty(rebateData?.distributed) ? null : (
              <SizableText mx="$5" size="$bodyMdMedium" color="$textSubdued">
                {intl.formatMessage({ id: ETranslations.referral_distributed })}
              </SizableText>
            )}
            {rebateData?.distributed.map((item, index) => {
              const needDivider =
                index === rebateData.distributed.length - 1 &&
                !isEmpty(rebateData?.undistributed);

              return itemRender({
                key: index,
                needDivider,
                children: (
                  <>
                    <XStack ai="center" gap="$2.5">
                      <Token
                        size="sm"
                        borderRadius="$2"
                        tokenImageUri={item.token.logoURI}
                      />
                      <EarnText
                        size="$bodyMdMedium"
                        color="$text"
                        text={item.title}
                      />
                    </XStack>
                    <EarnActionIcon
                      actionIcon={item.button}
                      onHistory={handleHistoryClick}
                    />
                  </>
                ),
              });
            })}
            {isEmpty(rebateData?.undistributed) ? null : (
              <SizableText mx="$5" size="$bodyMdMedium" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.referral_undistributed,
                })}
              </SizableText>
            )}
            {rebateData?.undistributed.map((item, index) => {
              return itemRender({
                key: index,
                children: (
                  <XStack ai="center" jc="space-between" w="100%">
                    <XStack gap="$2.5" ai="center">
                      <Token
                        size="sm"
                        borderRadius="$2"
                        tokenImageUri={item.token.logoURI}
                      />
                      <EarnText
                        size="$bodyMdMedium"
                        color="$text"
                        text={item.title}
                      />
                    </XStack>
                    <EarnText
                      size="$bodyMdMedium"
                      color="$textSubdued"
                      text={item.description}
                    />
                  </XStack>
                ),
              });
            })}
            <Stack
              bg="$bgSubdued"
              mt="$2.5"
              px="$5"
              py="$3.5"
              borderTopWidth={1}
              borderTopColor="$borderSubdued"
            >
              <EarnText
                size="$bodySm"
                color="$textSubdued"
                text={rebateData.description}
              />
            </Stack>
          </YStack>
        }
      />
    </XStack>
  );
};

const OverviewComponent = ({
  isLoading,
  onRefresh,
}: {
  isLoading: boolean;
  onRefresh: () => void;
}) => {
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const totalFiatMapKey = useEarnAccountKey();
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
  const evmNetworkId = useMemo(() => getNetworkIdsMap().eth, []);
  const evmAccount = useMemo(() => {
    return earnAccount?.[totalFiatMapKey]?.accounts?.find(
      (item) => item.networkId === evmNetworkId,
    );
  }, [earnAccount, totalFiatMapKey, evmNetworkId]);

  const navigation = useAppNavigation();
  const intl = useIntl();

  // Fetch rebate data for popover
  const { result: rebateData, isLoading: isRebateLoading } =
    usePromiseResult(async () => {
      if (!evmAccount) return null;
      return backgroundApiProxy.serviceStaking.getEarnSummaryV2({
        accountAddress: evmAccount.accountAddress,
        networkId: evmAccount.networkId,
      });
    }, [evmAccount]);

  const shouldShowReferralBonus = useMemo(
    () => !!evmAccount && !isRebateLoading && !!rebateData,
    [evmAccount, isRebateLoading, rebateData],
  );

  const handleHistoryPress = useCallback(async () => {
    if (!evmAccount || !account?.id) return;
    const currentEarnAccount =
      await backgroundApiProxy.serviceStaking.getEarnAccount({
        accountId: account.id,
        indexedAccountId: indexedAccount?.id || '',
        networkId: evmNetworkId,
        btcOnlyTaproot: true,
      });
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.HistoryList,
      params: {
        title: intl.formatMessage({
          id: ETranslations.referral_reward_history,
        }),
        alerts: [
          {
            key: ESpotlightTour.earnRewardHistory,
            badge: 'info',
            alert: intl.formatMessage({
              id: ETranslations.earn_reward_distribution_schedule,
            }),
          } as IEarnAlert,
        ],
        accountId: currentEarnAccount?.account.id || '',
        networkId: evmNetworkId,
        filterType: 'rebate',
      },
    });
  }, [
    navigation,
    evmAccount,
    account?.id,
    indexedAccount?.id,
    evmNetworkId,
    intl,
  ]);

  const handleRefresh = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  return (
    <YStack
      gap="$1"
      px="$0"
      flex={1}
      $gtLg={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
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
          <IconButton
            icon="RefreshCcwOutline"
            variant="tertiary"
            loading={isLoading}
            onPress={handleRefresh}
          />
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

      {shouldShowReferralBonus ? (
        <Rebate
          rebateData={rebateData!}
          handleHistoryPress={handleHistoryPress}
        />
      ) : null}
    </YStack>
  );
};

export const Overview = memo(OverviewComponent);
