import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Divider,
  IconButton,
  NumberSizeableText,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatBalance } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IEarnRewardNum,
  IEarnTokenItem,
} from '@onekeyhq/shared/types/staking';

function RewardItem({
  rewardTokenAddress,
  rewardData,
  rewardToken,
  symbol,
  onClaim,
  isLast,
}: {
  rewardTokenAddress: string;
  rewardData: IEarnRewardNum[string];
  rewardToken?: IEarnTokenItem;
  symbol: string;
  onClaim?: (params: any) => void;
  isLast: boolean;
}) {
  const intl = useIntl();

  // check rewardToken is valid
  if (!rewardToken?.info?.symbol || !rewardToken?.info?.logoURI) {
    console.warn(`Missing token info for reward token: ${rewardTokenAddress}`);
    return null;
  }

  const claimableNowBN = new BigNumber(rewardData.claimableNow || '0');
  const validClaimableNow =
    claimableNowBN.isNaN() || claimableNowBN.lt(0)
      ? new BigNumber(0)
      : claimableNowBN;

  const claimableNextBN = new BigNumber(rewardData.claimableNext || '0');
  const validClaimableNext =
    claimableNextBN.isNaN() || claimableNextBN.lt(0)
      ? new BigNumber(0)
      : claimableNextBN;

  const fiatClaimableNowValue = validClaimableNow.multipliedBy(
    rewardToken.price,
  );
  const fiatClaimableNextValue = validClaimableNext.multipliedBy(
    rewardToken.price,
  );

  const formattedFiatClaimableNextValue = fiatClaimableNextValue.lt(0.01)
    ? `<${symbol}0.01`
    : `${symbol}${
        formatBalance(fiatClaimableNextValue.toFixed()).formattedValue
      }`;

  return (
    <>
      <YStack gap="$2.5">
        <XStack
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap="$2"
        >
          <XStack alignItems="center" flex={1} flexWrap="wrap">
            <Token
              mr="$1.5"
              size="sm"
              tokenImageUri={rewardToken.info?.logoURI}
            />
            <XStack flex={1} flexWrap="wrap" alignItems="center">
              <NumberSizeableText
                size="$bodyLgMedium"
                formatter="balance"
                formatterOptions={{ tokenSymbol: rewardToken.info?.symbol }}
              >
                {validClaimableNow.toFixed()}
              </NumberSizeableText>
              {fiatClaimableNowValue.gt(0) ? (
                <SizableText size="$bodyLgMedium">
                  (
                  <NumberSizeableText
                    size="$bodyLgMedium"
                    formatter="value"
                    formatterOptions={{ currency: symbol }}
                  >
                    {fiatClaimableNowValue.lt(0.01)
                      ? `<${symbol}0.01`
                      : fiatClaimableNowValue.toFixed()}
                  </NumberSizeableText>
                  )
                </SizableText>
              ) : null}
            </XStack>
          </XStack>
          <Button
            size="small"
            variant="primary"
            disabled={validClaimableNow.isZero()}
            onPress={() => {
              onClaim?.({
                amount: validClaimableNow.toFixed(),
                isMorphoClaim: true,
                claimTokenAddress: rewardTokenAddress,
              });
            }}
          >
            {intl.formatMessage({
              id: ETranslations.earn_claim,
            })}
          </Button>
        </XStack>
        <XStack>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage(
              { id: ETranslations.earn_claimable_in_future },
              {
                value: (
                  <NumberSizeableText
                    size="$bodyMd"
                    color="$textSubdued"
                    formatter="balance"
                  >
                    {validClaimableNext.toFixed()}
                  </NumberSizeableText>
                ),
                symbol: rewardToken.info?.symbol,
                fiatValue: formattedFiatClaimableNextValue,
              },
            )}
          </SizableText>
        </XStack>
      </YStack>
      {!isLast ? <Divider my="$1.5" /> : null}
    </>
  );
}

export function ProtocolRewards({
  rewardNum,
  rewardAssets,
  onClaim,
  updateFrequency,
}: {
  rewardNum?: IEarnRewardNum;
  rewardAssets?: Record<string, IEarnTokenItem>;
  updateFrequency: string;
  onClaim?: (params?: {
    amount: string;
    claimTokenAddress?: string;
    isReward?: boolean;
    isMorphoClaim?: boolean;
  }) => void;
}) {
  const intl = useIntl();

  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const displayRewards =
    rewardNum &&
    Object.keys(rewardNum).length > 0 &&
    Object.values(rewardNum).some(
      (value) =>
        new BigNumber(value.claimableNow).isGreaterThan(0) ||
        new BigNumber(value.claimableNext).isGreaterThan(0),
    );

  if (!displayRewards) {
    return null;
  }

  return (
    <YStack
      gap="$2.5"
      mt="$3"
      py="$3.5"
      px="$4"
      borderRadius="$3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      bg="$bgSubdued"
    >
      <XStack alignItems="center" gap="$1">
        <SizableText color="$textSubdued" size="$bodyMd">
          {intl.formatMessage({
            id: ETranslations.earn_protocol_rewards,
          })}
        </SizableText>
        <Popover
          title={intl.formatMessage({
            id: ETranslations.earn_protocol_rewards,
          })}
          placement="top"
          renderTrigger={
            <IconButton
              iconColor="$iconSubdued"
              size="small"
              icon="InfoCircleOutline"
              variant="tertiary"
            />
          }
          renderContent={
            <Stack p="$5">
              <SizableText color="$text" size="$bodyLg">
                {intl.formatMessage(
                  {
                    id: ETranslations.earn_claim_rewards_morpho_desc,
                  },
                  {
                    time: updateFrequency || '',
                  },
                )}
              </SizableText>
            </Stack>
          }
        />
      </XStack>
      {Object.entries(rewardNum).map(
        ([rewardTokenAddress, rewardData], index) => (
          <RewardItem
            key={rewardTokenAddress}
            rewardTokenAddress={rewardTokenAddress}
            rewardData={rewardData}
            rewardToken={rewardAssets?.[rewardTokenAddress]}
            symbol={symbol}
            onClaim={onClaim}
            isLast={index === Object.keys(rewardNum).length - 1}
          />
        ),
      )}
    </YStack>
  );
}
