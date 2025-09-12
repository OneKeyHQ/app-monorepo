import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type {
  IEarnTokenItem,
  IStakeProtocolDetails,
} from '@onekeyhq/shared/types/staking';

import { capitalizeString } from '../../utils/utils';

import { GridItem } from './GridItem';

type IProviderInfoProps = {
  validator?: {
    isProtocol?: boolean;
    name: string;
    link: string;
    vaultName?: string;
    vaultLink?: string;
    vaultManager?: string;
    vaultManagerName?: string;
    totalStaked?: string;
    totalStakedFiatValue?: string;
    liquidity?: string;
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
  poolFee?: {
    value: string;
  };
  token?: IEarnTokenItem;
};

function ProviderInfo({
  validator,
  minOrMaxStaking,
  untilNextLaunch,
  network,
  babylonConfirmedCap,
  babylonStakingCap,
  token,
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
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const isMorphoProvider = useMemo(
    () =>
      earnUtils.isMorphoProvider({
        providerName: validator?.name ?? '',
      }),
    [validator?.name],
  );
  return (
    <YStack gap="$6">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.swap_history_detail_provider })}
      </SizableText>
      <XStack flexWrap="wrap" m="$-5" p="$2">
        {!isMorphoProvider && validator ? (
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
        {isMorphoProvider && validator?.vaultName ? (
          <GridItem
            title={intl.formatMessage({ id: ETranslations.earn_vault })}
            link={validator?.vaultLink}
          >
            {validator?.vaultName}
          </GridItem>
        ) : null}
        {isMorphoProvider && validator?.vaultManagerName ? (
          <GridItem
            title={intl.formatMessage({ id: ETranslations.earn_vault_manager })}
            link={validator?.vaultManager}
          >
            {validator?.vaultManagerName}
          </GridItem>
        ) : null}
        {validator?.totalStakedFiatValue ? (
          <GridItem title={intl.formatMessage({ id: ETranslations.earn_tvl })}>
            <NumberSizeableText
              userSelect="none"
              size="$bodyLgMedium"
              formatterOptions={{ currency }}
              formatter="marketCap"
            >
              {validator?.totalStakedFiatValue}
            </NumberSizeableText>
          </GridItem>
        ) : null}
        {validator?.liquidity ? (
          <GridItem
            title={intl.formatMessage({ id: ETranslations.global_liquidity })}
          >
            <NumberSizeableText
              userSelect="none"
              size="$bodyLgMedium"
              formatterOptions={{ tokenSymbol: token?.info.symbol }}
              formatter="marketCap"
            >
              {validator?.liquidity}
            </NumberSizeableText>
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
      vaultManager: details.provider.vaultManager,
      vaultManagerName: details.provider.vaultManagerName,
      vaultName: details.provider.vaultName,
      vaultLink: details.provider.url,
      isProtocol: details.provider.name.toLowerCase() !== 'everstake',
      totalStaked: details.provider.totalStaked,
      totalStakedFiatValue: details.provider.totalStakedFiatValue,
      liquidity: details.provider.liquidity,
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
    if (details.provider.poolFee) {
      providerProps.poolFee = {
        value: details.provider.poolFee,
      };
    }
  }
  if (details.network) {
    providerProps.network = details.network;
  }
  if (details.token) {
    providerProps.token = details.token;
  }
  if (Object.keys(providerProps).length === 0) {
    return null;
  }
  return <ProviderInfo {...providerProps} />;
};
