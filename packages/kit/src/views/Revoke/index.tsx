import type { FC } from 'react';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Empty,
  ScrollView,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type {
  ERC20TokenAllowance,
  ERC721TokenAllowance,
} from '@onekeyhq/engine/src/managers/revoke';
import { toFloat } from '@onekeyhq/engine/src/managers/revoke';
import { TokenRiskLevel } from '@onekeyhq/engine/src/types/token';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { NetworkAccountSelectorTrigger } from '../../components/NetworkAccountSelector';
import { useActiveWalletAccount } from '../../hooks';
import { useConnectAndCreateExternalAccount } from '../ExternalAccount/useConnectAndCreateExternalAccount';

import FilterBar from './FilterBar';
import RevokeHeader from './Header';
import { useTokenAllowances } from './hooks';
import { ERC20TokenList } from './List/ERC20TokenList';
import { ERC721TokenList } from './List/ERC721TokenList';
import { AssetType } from './types';

const defaultFilter = {
  assetType: AssetType.tokens,
  includeUnverifiedTokens: true,
  includeZeroBalancesTokens: true,
  includeTokensWithoutAllowances: true,
};

const RevokePage: FC = () => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const [headerParams, setHeaderParams] = useState<
    | {
        address?: string;
        networkId?: string;
        loading: boolean;
      }
    | undefined
  >();
  const [filters, setFilters] = useState(defaultFilter);
  const { network, account } = useActiveWalletAccount();

  const { connectAndCreateExternalAccount } =
    useConnectAndCreateExternalAccount({
      networkId: headerParams?.networkId ?? '',
    });

  const { loading, allowances, prices, isFromRpc } = useTokenAllowances(
    headerParams?.networkId ?? '',
    headerParams?.address ?? '',
    filters.assetType,
  );

  const onHeaderParamsChange = useCallback(
    (params: typeof headerParams) => {
      if (!params?.address) {
        return;
      }
      if (isEqual(params, headerParams)) {
        return;
      }
      setHeaderParams(params);
    },
    [setHeaderParams, headerParams],
  );

  const isLoading = loading || !!headerParams?.loading;

  const data = useMemo(() => {
    if (filters.assetType === AssetType.tokens) {
      return (allowances
        ?.filter(
          (item) =>
            item.allowance.length > 0 || filters.includeTokensWithoutAllowances,
        )
        ?.filter(
          ({ token }) =>
            filters.includeUnverifiedTokens ||
            token.riskLevel === TokenRiskLevel.VERIFIED,
        )
        .filter(({ token, balance }) => {
          if (filters.includeZeroBalancesTokens) {
            return true;
          }
          if (filters.assetType === AssetType.tokens) {
            return !(toFloat(Number(balance), token.decimals) === '0.000');
          }
          return balance === '0';
        }) ?? []) as ERC20TokenAllowance[];
    }

    return (allowances
      ?.filter(
        (item) =>
          item.allowance.length > 0 || filters.includeTokensWithoutAllowances,
      )
      ?.filter(({ balance }) => {
        if (filters.includeZeroBalancesTokens) {
          return true;
        }
        return balance !== '0';
      }) ?? []) as ERC721TokenAllowance[];
  }, [filters, allowances]);

  const navigation = useNavigation();

  const walletConnectButton = useMemo(() => {
    if (!platformEnv.isWeb || account?.id) {
      return null;
    }
    return (
      <Button onPress={connectAndCreateExternalAccount} mr={6}>
        {intl.formatMessage({ id: 'action__connect_wallet' })}
      </Button>
    );
  }, [intl, connectAndCreateExternalAccount, account?.id]);

  const headerRight = useCallback(() => {
    if (!account?.id) {
      return walletConnectButton;
    }
    return (
      <Box pr="6">
        <NetworkAccountSelectorTrigger type={isVertical ? 'plain' : 'basic'} />
      </Box>
    );
  }, [account?.id, isVertical, walletConnectButton]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight,
    });
  }, [navigation, headerRight]);

  const content = useMemo(() => {
    if (network && network?.impl !== IMPL_EVM && !isLoading) {
      return (
        <Empty
          emoji="🤷‍♀️"
          title={intl.formatMessage(
            {
              id: 'title__str_network_is_not_supported_yet',
            },
            {
              chain: network?.shortName ?? '',
            },
          )}
          subTitle={intl.formatMessage({
            id: 'title__str_network_is_not_supported_yet_desc',
          })}
        />
      );
    }
    if (headerParams && !headerParams?.address && !isLoading) {
      return (
        <Empty
          emoji="💁‍♀️️"
          title={intl.formatMessage({
            id: 'title__enter_address_or_connect_wallet',
          })}
          subTitle={intl.formatMessage({
            id: 'title__enter_address_or_connect_wallet_desc',
          })}
        />
      );
    }

    return filters.assetType === AssetType.tokens ? (
      <ERC20TokenList
        loading={isLoading}
        allowances={data as ERC20TokenAllowance[]}
        address={headerParams?.address ?? ''}
        prices={prices}
        networkId={headerParams?.networkId ?? ''}
      />
    ) : (
      <ERC721TokenList
        networkId={headerParams?.networkId ?? ''}
        loading={isLoading}
        allowances={data}
        address={headerParams?.address ?? ''}
      />
    );
  }, [network, intl, data, isLoading, prices, filters.assetType, headerParams]);

  return (
    <ScrollView
      contentContainerStyle={{
        justifyContent: 'center',
        padding: isVertical ? 16 : 32,
      }}
    >
      <Center flex="1" pb="108px">
        <RevokeHeader onChange={onHeaderParamsChange} />
        <VStack maxW="1030px" w="100%">
          <FilterBar {...filters} isFromRpc={isFromRpc} onChange={setFilters} />
          {content}
        </VStack>
      </Center>
    </ScrollView>
  );
};

export default RevokePage;
