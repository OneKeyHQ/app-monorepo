import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Divider,
  Icon,
  NumberSizeableText,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNavigateToEarnReward } from '../../../EarnReward/hooks/useNavigateToEarnReward';
import { FiatValue } from '../shared/FiatValue';
import { NoRewardYet } from '../shared/NoRewardYet';

import type { IOnChainRewardProps } from './types';

const DEFAULT_EARN_IMAGE_URL =
  'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address-0xaf88d065e77c8cc2239327c5edb3a432268e5831-1720669320510.png';

export function OnChainReward({ onChain }: IOnChainRewardProps) {
  const navigateToEarnReward = useNavigateToEarnReward();
  const intl = useIntl();

  const { activeAccount } = useActiveAccount({ num: 0 });

  const toEarnRewardPage = useCallback(() => {
    navigateToEarnReward(onChain.title || '');
  }, [navigateToEarnReward, onChain.title]);

  const showEarnSalesAvailableFiat = (onChain.available?.length || 0) > 0;

  const onChainSummary = useMemo(() => {
    return onChain.available
      ?.reduce((acc, curr) => {
        return acc.plus(BigNumber(curr.usdValue));
      }, BigNumber(0))
      .toFixed(2);
  }, [onChain.available]);

  const onChainSummaryFiat = useMemo(() => {
    return onChain.available
      ?.reduce((acc, curr) => {
        return acc.plus(BigNumber(curr.fiatValue));
      }, BigNumber(0))
      .toFixed(2);
  }, [onChain.available]);

  const { result: earnToken } = usePromiseResult(async () => {
    return backgroundApiProxy.serviceToken.getToken({
      networkId: PERPS_NETWORK_ID,
      tokenIdOnNetwork: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      accountId: activeAccount.account?.id ?? '',
    });
  }, [activeAccount.account?.id]);

  return (
    <YStack
      pb="$4"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
    >
      <YStack pt="$4" px="$5" onPress={toEarnRewardPage} cursor="pointer">
        <XStack ai="center" jc="space-between">
          <XStack gap="$1" ai="center">
            <Icon name="CoinsOutline" size="$5" />
            <SizableText size="$headingMd">{onChain.title}</SizableText>
          </XStack>
          <Icon size="$4.5" color="$iconSubdued" name="ChevronRightOutline" />
        </XStack>
        <SizableText mt="$0.5" size="$bodyMd" color="$textSubdued">
          {onChain.description}
        </SizableText>
      </YStack>
      <YStack px="$5">
        {showEarnSalesAvailableFiat ? (
          <YStack gap="$2" pt="$4">
            <XStack>
              <Token
                size="xs"
                tokenImageUri={earnToken?.logoURI || DEFAULT_EARN_IMAGE_URL}
              />
              <XStack pl="$2" pr="$3">
                <XStack gap="$1">
                  <SizableText size="$bodyMd">≈</SizableText>
                  <NumberSizeableText
                    formatter="value"
                    size="$bodyMd"
                    formatterOptions={{
                      tokenSymbol: 'USDC',
                    }}
                  >
                    {onChainSummary}
                  </NumberSizeableText>
                </XStack>
                <FiatValue fiatValue={onChainSummaryFiat} />
              </XStack>
              <Popover.Tooltip
                iconSize="$5"
                title={intl.formatMessage({
                  id: ETranslations.referral_earn_reward_details,
                })}
                renderContent={
                  <YStack borderRadius="$3" overflow="hidden">
                    <YStack px="$5">
                      {onChain.available?.map(
                        ({ token, fiatValue, amount }, index) => {
                          return (
                            <XStack
                              key={index}
                              gap="$2"
                              h={48}
                              ai="center"
                              jc="space-between"
                              py={5}
                            >
                              <XStack gap="$2.5" ai="center">
                                <Token
                                  size="sm"
                                  tokenImageUri={token.logoURI}
                                />
                                <SizableText size="$bodyMdMedium">
                                  {token.symbol.toUpperCase()}
                                </SizableText>
                              </XStack>
                              <YStack ai="flex-end">
                                <NumberSizeableText
                                  formatter="balance"
                                  size="$bodyMdMedium"
                                >
                                  {amount}
                                </NumberSizeableText>
                                <Currency
                                  formatter="balance"
                                  size="$bodySmMedium"
                                  color="$textSubdued"
                                >
                                  {fiatValue}
                                </Currency>
                              </YStack>
                            </XStack>
                          );
                        },
                      )}
                    </YStack>
                    <Divider />
                    <XStack
                      ai="center"
                      gap="$2"
                      py="$2.5"
                      px="$5"
                      bg="$bgSubdued"
                    >
                      <Stack>
                        <Icon
                          color="$iconSubdued"
                          size="$5"
                          name="InfoCircleOutline"
                        />
                      </Stack>
                      <SizableText flex={1} size="$bodyMd" color="$textSubdued">
                        {intl.formatMessage({
                          id: ETranslations.referral_earn_reward_details_desc,
                        })}
                      </SizableText>
                    </XStack>
                  </YStack>
                }
              />
            </XStack>
          </YStack>
        ) : (
          <NoRewardYet />
        )}
      </YStack>
    </YStack>
  );
}
