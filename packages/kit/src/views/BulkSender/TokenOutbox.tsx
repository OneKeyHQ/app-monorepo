import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import natsort from 'natsort';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Icon,
  Pressable,
  Token as TokenComponent,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { useAppSelector } from '@onekeyhq/kit/src/hooks';
import { useManageTokensOfAccount } from '@onekeyhq/kit/src/hooks/useManageTokens';
import { useManageTokenprices } from '@onekeyhq/kit/src/hooks/useManegeTokenPrice';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import { getTokenValues } from '@onekeyhq/kit/src/utils/priceUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { IutputEditor } from './IutputEditor';
import { BulkSenderRoutes } from './types';

interface Props {
  accountId: string;
  networkId: string;
  isNative?: boolean;
}

function TokenOutbox(props: Props) {
  const { accountId, networkId, isNative } = props;
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const navigation = useNavigation();
  const { accountTokens, nativeToken, balances, loading } =
    useManageTokensOfAccount({
      accountId,
      networkId,
    });
  const { prices } = useManageTokenprices({ networkId, accountId });
  const vsCurrency = useAppSelector((s) => s.settings.selectedFiatMoneySymbol);
  const valueSortedTokens = useMemo(() => {
    const tokenValues = new Map<Token, BigNumber>();
    const sortedTokens = accountTokens
      .filter((t) => {
        const priceId = `${networkId}${
          t.tokenIdOnNetwork ? `-${t.tokenIdOnNetwork}` : ''
        }`;
        if (t.tokenIdOnNetwork && !prices?.[priceId]) {
          tokenValues.set(t, new BigNumber(-1));
        }
        const [v] = getTokenValues({
          tokens: [t],
          prices,
          balances,
          vsCurrency,
        });
        tokenValues.set(t, v);
        if (t.isNative) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const priceIda = `${networkId}${
          a.tokenIdOnNetwork ? `-${a.tokenIdOnNetwork}` : ''
        }`;
        const priceIdb = `${networkId}${
          b.tokenIdOnNetwork ? `-${b.tokenIdOnNetwork}` : ''
        }`;
        return (
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          tokenValues.get(b)!.comparedTo(tokenValues.get(a)!) ||
          new BigNumber(prices?.[priceIdb]?.[vsCurrency] || 0).comparedTo(
            new BigNumber(prices?.[priceIda]?.[vsCurrency] || 0),
          ) ||
          natsort({ insensitive: true })(a.name, b.name)
        );
      });

    return sortedTokens;
  }, [accountTokens, networkId, prices, balances, vsCurrency]);

  const initialToken = isNative ? nativeToken : valueSortedTokens[0];
  const formatedBalance = useMemo(
    () =>
      intl.formatMessage(
        { id: 'content__balance_str' },
        {
          0: balances[
            selectedToken?.tokenIdOnNetwork ||
              initialToken?.tokenIdOnNetwork ||
              'main'
          ],
        },
      ),
    [balances, intl, initialToken, selectedToken],
  );

  const handleOnTokenSelected = useCallback((token: Token) => {
    setSelectedToken(token);
  }, []);

  const handleOpenTokenSelector = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.BulkSender,
      params: {
        screen: BulkSenderRoutes.TokenSelector,
        params: {
          accountId,
          networkId,
          tokens: valueSortedTokens,
          balances,
          onTokenSelected: handleOnTokenSelected,
        },
      },
    });
  }, [
    accountId,
    balances,
    handleOnTokenSelected,
    navigation,
    networkId,
    valueSortedTokens,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (accountId && networkId) {
        backgroundApiProxy.serviceToken.fetchAccountTokens({
          activeAccountId: accountId,
          activeNetworkId: networkId,
        });
      }
    }, [accountId, networkId]),
  );

  useEffect(() => {
    if (accountId && networkId) {
      setSelectedToken(null);
    }
  }, [accountId, networkId]);

  return (
    <Box paddingX={isVertical ? 4 : 0} paddingY={5}>
      <Pressable.Item
        disabled={loading || isNative}
        px={4}
        py={2}
        borderColor="border-default"
        borderWidth={1}
        borderRadius={12}
        onPress={handleOpenTokenSelector}
      >
        <HStack alignItems="center">
          <TokenComponent
            flex={1}
            size={8}
            showInfo
            showTokenVerifiedIcon={false}
            token={selectedToken || initialToken}
            name={selectedToken?.symbol || initialToken?.symbol}
            showExtra={false}
            description={formatedBalance}
          />
          {!isNative && (
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          )}
        </HStack>
      </Pressable.Item>
      <Box mt={6}>
        <IutputEditor />
      </Box>
    </Box>
  );
}

export { TokenOutbox };
