import { useCallback, useEffect, useMemo } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Image,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { formatAmount } from '../../../../utils/priceUtils';
import { EthStakingSource, StakingRoutes } from '../../typing';
import { isSTETH, isSupportStakedAssets } from '../../utils';

import type { ImageSourcePropType } from 'react-native';

type OptionsProps = {
  title: string;
  subtitle: string;
  logo: ImageSourcePropType;
  num: string;
  onPress?: () => void;
};

export const Options: FC<OptionsProps> = ({
  title,
  subtitle,
  logo,
  num,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    bg="surface-default"
    px="4"
    py="3"
    flexDirection="row"
    justifyContent="space-between"
    borderRadius={12}
  >
    <Box flexDirection="row" alignItems="center">
      <Box mr="3" position="relative">
        <Image
          w="10"
          h="10"
          source={require('@onekeyhq/kit/assets/staking/eth_logo.png')}
        />
        <Box
          w="5"
          h="5"
          background="surface-subdued"
          flexDirection="row"
          justifyContent="center"
          alignItems="center"
          borderRadius="full"
          position="absolute"
          bottom="-1"
          right="-1"
        >
          <Image w="4" h="4" source={logo} />
        </Box>
      </Box>
      <Box>
        <Typography.Body1Strong>{title}</Typography.Body1Strong>
        <Typography.Body2 color="text-subdued">{subtitle}</Typography.Body2>
      </Box>
    </Box>
    <Box flexDirection="row" justifyContent="center" alignItems="center">
      <Typography.Body1Strong color="text-success">
        {num}
      </Typography.Body1Strong>
    </Box>
  </Pressable>
);

type EthAprOptionProps = {
  isTestnet?: boolean;
};

const EthAprOption: FC<EthAprOptionProps> = ({ isTestnet }) => {
  const navigation = useNavigation();
  const intl = useIntl();
  useEffect(() => {
    backgroundApiProxy.serviceStaking.fetchEthAprSma();
  }, []);

  const ethStakingApr = useAppSelector((s) => s.staking.ethStakingApr);

  const topApr = useMemo(() => {
    if (!ethStakingApr) return undefined;
    const items = isTestnet ? ethStakingApr.testnet : ethStakingApr.mainnet;
    return items.kele > items.lido
      ? {
          name: 'Kele • Ethereum',
          value: `${formatAmount(items.kele, 2)}%`,
          logo: require('@onekeyhq/kit/assets/staking/kele_pool.png'),
        }
      : {
          name: 'Lido • Ethereum',
          value: `${formatAmount(items.lido, 2)}%`,
          logo: require('@onekeyhq/kit/assets/staking/lido_pool.png'),
        };
  }, [ethStakingApr, isTestnet]);

  const onNext = useCallback(
    (isKele?: boolean) => {
      if (isKele) {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Staking,
          params: {
            screen: StakingRoutes.ETHStake,
            params: { source: EthStakingSource.Kele },
          },
        });
      } else {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Staking,
          params: {
            screen: StakingRoutes.LidoEthStakeShouldUnderstand,
            params: {},
          },
        });
      }
    },
    [navigation],
  );

  const onViewApr = useCallback(() => {
    if (!topApr) {
      return;
    }
    if (topApr.name === 'Kele • Ethereum') {
      onNext(true);
    } else {
      onNext(false);
    }
  }, [topApr, onNext]);

  const onViewAll = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.ETHPoolSelector,
        params: {
          isTestnet: Boolean(isTestnet),
          onSelector: (source) => {
            if (source === EthStakingSource.Kele) {
              onNext(true);
            } else {
              onNext(false);
            }
          },
        },
      },
    });
  }, [navigation, isTestnet, onNext]);

  if (!topApr) {
    return null;
  }

  return (
    <Box>
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        h="16"
      >
        <Typography.Heading>
          {intl.formatMessage({ id: 'form__top_yields' })}
        </Typography.Heading>
        <Button
          type="plain"
          size="sm"
          pr="0"
          rightIconName="ChevronRightMini"
          onPress={onViewAll}
        >
          {intl.formatMessage({ id: 'action__view_all' })}
        </Button>
      </Box>
      <Options
        title="ETH"
        subtitle={topApr.name}
        num={topApr.value}
        logo={topApr.logo}
        onPress={onViewApr}
      />
    </Box>
  );
};

const RelatedPool: FC<EthAprOptionProps> = ({ isTestnet }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const ethStakingApr = useAppSelector((s) => s.staking.ethStakingApr);
  const lidoApr = useMemo(() => {
    if (!ethStakingApr) return undefined;
    const items = isTestnet ? ethStakingApr.testnet : ethStakingApr.mainnet;
    return {
      name: 'Lido • Ethereum',
      value: `${formatAmount(items.lido, 2)}%`,
      logo: require('@onekeyhq/kit/assets/staking/lido_pool.png'),
    };
  }, [ethStakingApr, isTestnet]);

  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.LidoEthStakeShouldUnderstand,
        params: {},
      },
    });
  }, [navigation]);

  return (
    <Box>
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        h="16"
      >
        <Typography.Heading>
          {intl.formatMessage({ id: 'form__related_pool' })}
        </Typography.Heading>
        <Box />
      </Box>
      {lidoApr ? (
        <Options
          title="ETH"
          subtitle={lidoApr.name}
          num={lidoApr.value}
          logo={lidoApr.logo}
          onPress={onPress}
        />
      ) : null}
      <Box py="1">
        <Typography.Body2 color="text-subdued">
          {intl.formatMessage(
            {
              id: 'content__when_you_stake_str_you_receive_str',
            },
            { '0': 'ETH', '1': 'stETH' },
          )}
        </Typography.Body2>
      </Box>
    </Box>
  );
};

export const EthTopAprShowControl: FC<{ token?: Token }> = ({ token }) => {
  const isTestnet = token?.networkId === OnekeyNetwork.goerli;
  const isSupport = isSupportStakedAssets(
    token?.networkId,
    token?.tokenIdOnNetwork,
  );
  return isSupport ? <EthAprOption isTestnet={isTestnet} /> : null;
};

export const ETHRelatedPoolShowControl: FC<{ token?: Token }> = ({ token }) => {
  const isTestnet = token?.networkId === OnekeyNetwork.goerli;
  const stETH = isSTETH(token?.networkId, token?.tokenIdOnNetwork);
  return stETH ? <RelatedPool isTestnet={isTestnet} /> : null;
};
