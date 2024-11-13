import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Alert,
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

type IPortfolioItemProps = {
  tokenImageUri?: string;
  tokenSymbol: string;
  amount: string;
  statusText: string;
  onPress?: () => Promise<void> | void;
  buttonText?: string;
  tooltip?: string;
  disabled?: boolean;
  useLoading?: boolean;
};

const PortfolioItem = ({
  tokenImageUri,
  tokenSymbol,
  amount,
  statusText,
  onPress,
  buttonText,
  tooltip,
  disabled,
  useLoading,
}: IPortfolioItemProps) => {
  const [loading, setLoading] = useState(false);
  const handlePress = useCallback(async () => {
    try {
      if (useLoading) {
        setLoading(true);
      }
      await onPress?.();
    } finally {
      if (useLoading) {
        setLoading(false);
      }
    }
  }, [onPress, useLoading]);
  return (
    <XStack minHeight={30} alignItems="center" justifyContent="space-between">
      <XStack alignItems="center" gap="$1.5">
        <Token size="sm" tokenImageUri={tokenImageUri} />
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="balance"
          formatterOptions={{ tokenSymbol }}
        >
          {amount}
        </NumberSizeableText>
        <XStack gap="$1" ai="center">
          <SizableText size="$bodyLg">{statusText}</SizableText>
        </XStack>
        {tooltip ? (
          <Popover
            placement="bottom"
            title={statusText}
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
                <SizableText>{tooltip}</SizableText>
              </Stack>
            }
          />
        ) : null}
      </XStack>
      {buttonText && onPress ? (
        <Button
          size="small"
          disabled={disabled}
          variant="primary"
          onPress={handlePress}
          loading={loading}
        >
          {buttonText}
        </Button>
      ) : null}
    </XStack>
  );
};

type IPortfolioInfoProps = {
  token: IToken;
  active?: string;
  pendingInactive?: string;
  pendingInactivePeriod?: string;
  pendingActive?: string;
  pendingActiveTooltip?: string;
  claimable?: string;
  rewards?: string;

  tooltipForClaimable?: string;
  labelForClaimable?: string;

  minClaimableNum?: string;
  babylonOverflow?: string;

  onClaim?: (params?: { isReward?: boolean }) => void;
  onWithdraw?: () => void;
  onPortfolioDetails?: () => void;
};

function PortfolioInfo({
  token,
  active,
  pendingInactive,
  pendingInactivePeriod,
  pendingActive,
  pendingActiveTooltip,
  claimable,
  rewards,

  tooltipForClaimable,
  labelForClaimable,

  minClaimableNum,

  babylonOverflow,

  onClaim,
  onWithdraw,
  onPortfolioDetails,
}: IPortfolioInfoProps) {
  const intl = useIntl();
  if (
    Number(pendingInactive) > 0 ||
    Number(claimable) > 0 ||
    Number(pendingActive) > 0 ||
    Number(babylonOverflow) > 0 ||
    Number(active) > 0
  ) {
    const isLessThanMinClaimable = Boolean(
      minClaimableNum && rewards && Number(rewards) < Number(minClaimableNum),
    );
    return (
      <>
        <YStack gap="$6">
          <XStack justifyContent="space-between">
            <SizableText size="$headingLg">
              {intl.formatMessage({ id: ETranslations.earn_portfolio })}
            </SizableText>
            {onPortfolioDetails !== undefined ? (
              <Button
                variant="tertiary"
                iconAfter="ChevronRightOutline"
                onPress={onPortfolioDetails}
              >
                {intl.formatMessage({ id: ETranslations.global_details })}
              </Button>
            ) : null}
          </XStack>
          <YStack gap="$3">
            {pendingActive && Number(pendingActive) ? (
              <PortfolioItem
                tokenImageUri={token.logoURI}
                tokenSymbol={token.symbol}
                amount={pendingActive}
                tooltip={pendingActiveTooltip}
                statusText={intl.formatMessage({
                  id: ETranslations.earn_pending_activation,
                })}
              />
            ) : null}
            {active && Number(active) ? (
              <PortfolioItem
                tokenImageUri={token.logoURI}
                tokenSymbol={token.symbol}
                amount={active}
                statusText={intl.formatMessage({
                  id: ETranslations.earn_active,
                })}
              />
            ) : null}
            {pendingInactive && Number(pendingInactive) ? (
              <PortfolioItem
                tokenImageUri={token.logoURI}
                tokenSymbol={token.symbol}
                amount={pendingInactive}
                statusText={intl.formatMessage({
                  id: ETranslations.earn_withdrawal_requested,
                })}
                tooltip={
                  pendingInactivePeriod
                    ? intl.formatMessage(
                        {
                          id: ETranslations.earn_withdrawal_up_to_number_days,
                        },
                        { number: pendingInactivePeriod },
                      )
                    : undefined
                }
              />
            ) : null}
            {claimable && Number(claimable) > 0 ? (
              <PortfolioItem
                tokenImageUri={token.logoURI}
                tokenSymbol={token.symbol}
                amount={claimable}
                statusText={
                  labelForClaimable ??
                  intl.formatMessage({
                    id: ETranslations.earn_claimable,
                  })
                }
                useLoading
                onPress={onClaim}
                buttonText={intl.formatMessage({
                  id: ETranslations.earn_claim,
                })}
                tooltip={tooltipForClaimable}
              />
            ) : null}
            {rewards && Number(rewards) > 0 ? (
              <PortfolioItem
                tokenImageUri={token.logoURI}
                tokenSymbol={token.symbol}
                amount={rewards}
                statusText={intl.formatMessage({
                  id: ETranslations.earn_rewards,
                })}
                onPress={() => onClaim?.({ isReward: true })}
                useLoading
                buttonText={intl.formatMessage({
                  id: ETranslations.earn_claim,
                })}
                tooltip={
                  isLessThanMinClaimable
                    ? intl.formatMessage(
                        {
                          id: ETranslations.earn_minimum_claim_tooltip,
                        },
                        { number: minClaimableNum, symbol: token.symbol },
                      )
                    : undefined
                }
                disabled={isLessThanMinClaimable}
              />
            ) : null}
            {Number(babylonOverflow) > 0 ? (
              <Alert
                fullBleed
                borderRadius="$3"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="$borderCautionSubdued"
                type="critical"
                title={intl.formatMessage(
                  {
                    id: ETranslations.earn_overflow_number_alert,
                  },
                  { number: babylonOverflow },
                )}
                action={{
                  primary: intl.formatMessage({
                    id: ETranslations.global_withdraw,
                  }),
                  onPrimaryPress: onWithdraw,
                }}
              />
            ) : null}
          </YStack>
        </YStack>
        <Divider />
      </>
    );
  }
  return null;
}

export const PortfolioSection = ({
  details,
  onClaim,
  onWithdraw,
  onPortfolioDetails,
}: {
  details?: IStakeProtocolDetails;
  onClaim?: (params?: { isReward?: boolean }) => void;
  onWithdraw?: () => void;
  onPortfolioDetails?: () => void;
}) => {
  const intl = useIntl();

  if (!details) {
    return null;
  }

  let pendingActiveTooltip: string | undefined;
  let labelForClaimable: string | undefined;
  let tooltipForClaimable: string | undefined;
  if (
    details.provider.name.toLowerCase() ===
      EEarnProviderEnum.Everstake.toLowerCase() &&
    details.token.info.symbol.toLowerCase() === 'eth'
  ) {
    pendingActiveTooltip = intl.formatMessage({
      id: ETranslations.earn_pending_activation_tooltip_eth,
    });
  } else if (details.pendingActivatePeriod) {
    pendingActiveTooltip = intl.formatMessage(
      {
        id: ETranslations.earn_pending_activation_tooltip,
      },
      { number: details.pendingActivatePeriod },
    );
  }
  if (
    details.provider.name.toLowerCase() ===
      EEarnProviderEnum.Everstake.toLowerCase() &&
    details.token.info.symbol.toLowerCase() === 'atom'
  ) {
    tooltipForClaimable = intl.formatMessage({
      id: ETranslations.earn_claim_together_tooltip,
    });
  }
  if (
    details.provider.name.toLowerCase() ===
      EEarnProviderEnum.Everstake.toLowerCase() &&
    details.token.info.symbol.toLowerCase() === 'matic'
  ) {
    labelForClaimable = intl.formatMessage({
      id: ETranslations.earn_withdrawn,
    });
  }

  const portfolio: IPortfolioInfoProps = {
    pendingInactive: details.pendingInactive,
    pendingInactivePeriod: details.unstakingPeriod
      ? String(details.unstakingPeriod)
      : undefined,
    pendingActive: details.pendingActive,
    pendingActiveTooltip,
    claimable: details.claimable,
    rewards: details.rewards,
    active: details.active,
    minClaimableNum: details.provider.minClaimableAmount,
    babylonOverflow:
      Number(details?.staked) > 0 && Number(details.overflow) > 0
        ? details.overflow
        : undefined,
    token: details.token.info,
    labelForClaimable,
    tooltipForClaimable,
  };

  return (
    <PortfolioInfo
      {...portfolio}
      onClaim={onClaim}
      onPortfolioDetails={onPortfolioDetails}
      onWithdraw={onWithdraw}
    />
  );
};
