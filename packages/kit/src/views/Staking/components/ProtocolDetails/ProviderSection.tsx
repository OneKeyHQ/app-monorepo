import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

import { capitalizeString } from '../../utils/utils';

import { GridItem } from './GridItem';

type IProviderInfoProps = {
  validator?: {
    isProtocol?: boolean;
    name: string;
    link: string;
  };
  minOrMaxStaking?: {
    minValue?: number;
    maxValue?: number;
    token: string;
  };
  untilNextLaunch?: {
    value: number;
    token: string;
  };
  network?: {
    name: string;
  };
  babylonStakingCap?: {
    value: string;
  };
  babylonConfirmedCap?: {
    value: string;
  };
};

function ProviderInfo({
  validator,
  minOrMaxStaking,
  untilNextLaunch,
  network,
  babylonConfirmedCap,
  babylonStakingCap,
}: IProviderInfoProps) {
  const intl = useIntl();
  let minOrMaxStakingItem: { label: string; value: string } | undefined;
  if (minOrMaxStaking) {
    const { minValue, maxValue } = minOrMaxStaking;
    if (maxValue && minValue) {
      minOrMaxStakingItem = {
        label: intl.formatMessage({
          id: ETranslations.earn_min_max_staking,
        }),
        value: `${minValue}/${maxValue} ${minOrMaxStaking.token}`,
      };
    } else if (minValue) {
      minOrMaxStakingItem = {
        label: intl.formatMessage({
          id: ETranslations.earn_min_staking,
        }),
        value: `${minValue} ${minOrMaxStaking.token}`,
      };
    }
  }
  return (
    <YStack gap="$6">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.swap_history_detail_provider })}
      </SizableText>
      <XStack flexWrap="wrap" m="$-5" p="$2">
        {validator ? (
          <GridItem
            title={
              validator.isProtocol
                ? intl.formatMessage({ id: ETranslations.global_protocol })
                : intl.formatMessage({ id: ETranslations.earn_validator })
            }
            link={validator.link}
          >
            {capitalizeString(validator.name)}
          </GridItem>
        ) : null}
        {minOrMaxStakingItem ? (
          <GridItem title={minOrMaxStakingItem.label}>
            <SizableText size="$bodyLgMedium">
              {minOrMaxStakingItem.value}
            </SizableText>
          </GridItem>
        ) : null}
        {untilNextLaunch ? (
          <GridItem
            title={intl.formatMessage({
              id: ETranslations.earn_until_next_launch,
            })}
            tooltip={intl.formatMessage({
              id: ETranslations.earn_until_next_launch_tooltip,
            })}
          >
            <SizableText size="$bodyLgMedium">
              {intl.formatMessage(
                { id: ETranslations.earn_number_symbol_left },
                {
                  number: Number(untilNextLaunch.value).toFixed(2),
                  symbol: untilNextLaunch.token,
                },
              )}
            </SizableText>
          </GridItem>
        ) : null}
        {network?.name ? (
          <GridItem
            title={intl.formatMessage({ id: ETranslations.global_network })}
          >
            {network.name}
          </GridItem>
        ) : null}
        {babylonStakingCap?.value ? (
          <GridItem
            title={intl.formatMessage({ id: ETranslations.earn_staking_cap })}
          >
            {babylonStakingCap.value} BTC
          </GridItem>
        ) : null}
        {babylonConfirmedCap?.value ? (
          <GridItem
            title={intl.formatMessage({ id: ETranslations.earn_confirmed_cap })}
          >
            {babylonConfirmedCap.value} BTC
          </GridItem>
        ) : null}
      </XStack>
    </YStack>
  );
}

export const ProviderSection = ({
  details,
}: {
  details?: IStakeProtocolDetails;
}) => {
  if (!details) return null;
  const providerProps: IProviderInfoProps = {};
  if (details.provider) {
    providerProps.validator = {
      name: details.provider.name,
      link: details.provider.website,
      isProtocol: details.provider.name.toLowerCase() !== 'everstake',
    };
    if (details.provider.minStakeAmount) {
      providerProps.minOrMaxStaking = {
        minValue: Number(details.provider.minStakeAmount),
        maxValue: Number(details.provider.maxStakeAmount),
        token: details.token.info.symbol,
      };
    }
    if (details.provider.nextLaunchLeft) {
      providerProps.untilNextLaunch = {
        value: Number(details.provider.nextLaunchLeft),
        token: details.token.info.symbol,
      };
    }
    if (details.provider.name === 'babylon') {
      if (
        details.provider.stakingCap &&
        Number(details.provider.stakingCap) > 0
      ) {
        providerProps.babylonStakingCap = {
          value: details.provider.stakingCap,
        };
      }
      if (
        details.provider.totalStaked &&
        Number(details.provider.totalStaked) > 0
      ) {
        providerProps.babylonConfirmedCap = {
          value: BigNumber(details.provider.totalStaked)
            .decimalPlaces(4)
            .toFixed(),
        };
      }
    }
  }
  if (details.network) {
    providerProps.network = details.network;
  }
  if (Object.keys(providerProps).length === 0) {
    return null;
  }
  return <ProviderInfo {...providerProps} />;
};
