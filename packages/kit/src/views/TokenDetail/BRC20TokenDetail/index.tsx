import { useCallback, useContext } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import {
  getTaprootXpub,
  isTaprootXpubSegwit,
} from '@onekeyhq/engine/src/vaults/utils/btcForkChain/utils';

import { FormatBalance } from '../../../components/Format';
import { useActiveSideAccount } from '../../../hooks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useBRC20Inscriptions } from '../../../hooks/useBRC20Inscriptions';
import {
  InscribeModalRoutes,
  InscriptionControlModalRoutes,
  ModalRoutes,
  ReceiveTokenModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../../routes/routesEnum';
import { TxHistoryListView } from '../../TxHistory/TxHistoryListView';
import { TokenDetailContext } from '../context';

import { InscriptionEntry } from './InscriptionEntry';
import { TokenActions } from './TokenActions';
import { TokenDetailHeader } from './TokenDetailHeader';

function BRC20TokenDetail() {
  const intl = useIntl();
  const context = useContext(TokenDetailContext);
  const isVertical = useIsVerticalLayout();
  const appNavigation = useAppNavigation();

  const { symbol, networkId, tokenAddress, accountId } =
    context?.routeParams ?? {};
  const positionInfo = context?.positionInfo;
  const detailInfo = context?.detailInfo;

  const token = detailInfo?.tokens[0];

  const { wallet, account, network } = useActiveSideAccount({
    accountId: accountId ?? '',
    networkId: networkId ?? '',
  });

  const { availableInscriptions } = useBRC20Inscriptions({
    networkId,
    address: account?.address,
    xpub: isTaprootXpubSegwit(account?.xpub ?? '')
      ? getTaprootXpub(account?.xpub ?? '')
      : account?.xpub,
    tokenAddress: token?.tokenIdOnNetwork ?? token?.address,
    isPolling: true,
  });

  const handleSendOnPress = useCallback(() => {
    if (accountId && networkId && token) {
      appNavigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendModalRoutes.PreSendBRC20TokenAmount,
          params: {
            networkId,
            accountId,
            token,
          },
        },
      });
    }
  }, [accountId, appNavigation, networkId, token]);

  const handleReceiveOnPress = useCallback(() => {
    appNavigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Receive,
      params: {
        screen: ReceiveTokenModalRoutes.ReceiveToken,
        params: {
          address: account?.address,
          displayAddress: account?.displayAddress,
          wallet,
          network,
          account,
          template: account?.template,
        },
      },
    });
  }, [account, appNavigation, network, wallet]);

  const handleTransferOnPress = useCallback(() => {
    if (accountId && networkId && token) {
      appNavigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Inscribe,
        params: {
          screen: InscribeModalRoutes.BRC20Amount,
          params: {
            networkId,
            accountId,
            token,
          },
        },
      });
    }
  }, [accountId, appNavigation, networkId, token]);

  const handleInscriptionControlOnPress = useCallback(() => {
    if (networkId && accountId && token) {
      appNavigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.InscriptionControl,
        params: {
          screen: InscriptionControlModalRoutes.InscriptionControlModal,
          params: {
            networkId,
            accountId,
            token,
          },
        },
      });
    }
  }, [accountId, appNavigation, networkId, token]);

  return (
    <Box paddingY={8} paddingX={isVertical ? 4 : 8}>
      {!isVertical ? (
        <TokenDetailHeader
          onPressSend={handleSendOnPress}
          onPressReceive={handleReceiveOnPress}
          onPressTransfer={handleTransferOnPress}
          style={{ mb: 8 }}
        />
      ) : null}
      <VStack mb={6} space={1}>
        <FormatBalance
          balance={positionInfo?.balance ?? 0}
          suffix={symbol}
          formatOptions={{
            fixed: 6,
          }}
          render={(ele) => (
            <Typography.DisplayXLarge>{ele}</Typography.DisplayXLarge>
          )}
        />
        <Typography.Body2 color="text-subdued">
          {`${intl.formatMessage({ id: 'form__available_colon' })} ${
            positionInfo?.availableBalance.toFixed() ?? '0'
          }`}
        </Typography.Body2>
        <Typography.Body2 color="text-subdued">
          {`${intl.formatMessage({ id: 'form__transferable_colon' })} ${
            positionInfo?.transferBalance.toFixed() ?? '0'
          }`}
        </Typography.Body2>
      </VStack>
      {isVertical ? (
        <TokenActions
          onPressSend={handleSendOnPress}
          onPressReceive={handleReceiveOnPress}
          onPressTransfer={handleTransferOnPress}
          style={{ mb: 6 }}
        />
      ) : null}
      <InscriptionEntry
        inscriptions={availableInscriptions}
        onPress={handleInscriptionControlOnPress}
        style={{ mb: 6 }}
      />
      <TxHistoryListView
        accountId={accountId}
        networkId={networkId}
        tokenId={tokenAddress}
        tabComponent
      />
    </Box>
  );
}

export { BRC20TokenDetail };
