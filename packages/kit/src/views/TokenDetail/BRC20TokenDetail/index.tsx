import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  ScrollView,
  Text,
  ToastManager,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import { isTaprootAddress } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/utils';
import { isWatchingAccount } from '@onekeyhq/shared/src/engine/engineUtils';
import { AppUIEventBusNames } from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { FormatBalance } from '../../../components/Format';
import { useActiveSideAccount } from '../../../hooks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useOnUIEventBus } from '../../../hooks/useOnUIEventBus';
import {
  InscribeModalRoutes,
  InscriptionControlModalRoutes,
  ModalRoutes,
  ReceiveTokenModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../../routes/routesEnum';
import { setAccountTokensBalances } from '../../../store/reducers/tokens';
import { openUrl } from '../../../utils/openUrl';
import { TxHistoryListView } from '../../TxHistory/TxHistoryListView';
import { TokenDetailContext } from '../context';

import { InscriptionEntry } from './InscriptionEntry';
import { TokenActions } from './TokenActions';
import { TokenDetailHeader } from './TokenDetailHeader';

const POLLING_INTERVAL = 30000;
const TRANSFER_BRC20_HELP_URL =
  'https://help.onekey.so/hc/zh-cn/articles/8531584136719';

let pollingTimer: NodeJS.Timeout | null = null;

function BRC20TokenDetail() {
  const intl = useIntl();
  const context = useContext(TokenDetailContext);

  const {
    symbol,
    networkId,
    tokenAddress,
    accountId,
    balance: balanceFromOut,
    transferBalance: transferBalanceFromOut,
    availableBalance: availableBalanceFromOut,
  } = context?.routeParams ?? {};
  const detailInfo = context?.detailInfo;

  const isVertical = useIsVerticalLayout();
  const appNavigation = useAppNavigation();
  const isFocused = useIsFocused();

  const [balanceInfo, setBalanceInfo] = useState({
    balance: balanceFromOut ?? '0',
    availableBalance: availableBalanceFromOut ?? '0',
    transferBalance: transferBalanceFromOut ?? '0',
  });
  const [recycleBalance, setRecycleBalance] = useState('0');
  const [isLoadingInscriptions, setIsLoadingInscriptions] = useState(false);
  const [availableInscriptions, setAvailableInscriptions] = useState<
    NFTBTCAssetModel[]
  >([]);

  const token = detailInfo?.tokens?.[0];

  const { wallet, account, network } = useActiveSideAccount({
    accountId: accountId ?? '',
    networkId: networkId ?? '',
  });

  const isWatching = useMemo(
    () => isWatchingAccount({ accountId: accountId ?? '' }),
    [accountId],
  );

  const isTaproot = useMemo(
    () => isTaprootAddress(account?.address ?? ''),
    [account?.address],
  );

  const balanceWithoutRecycle = useMemo(() => {
    const { balance, availableBalance, transferBalance } = balanceInfo;

    const balanceWithoutRecycle1 = new BigNumber(balance ?? '0').minus(
      recycleBalance,
    );
    const transferBalanceWithoutRecycle = new BigNumber(
      transferBalance ?? '0',
    ).minus(recycleBalance);

    return {
      balance: balanceWithoutRecycle1.isLessThan(0)
        ? '0'
        : balanceWithoutRecycle1.toFixed(),
      availableBalance,
      transferBalance: transferBalanceWithoutRecycle.isLessThan(0)
        ? '0'
        : transferBalanceWithoutRecycle.toFixed(),
    };
  }, [balanceInfo, recycleBalance]);

  const handleSendOnPress = useCallback(() => {
    if (accountId && networkId && token) {
      if (!isTaproot) {
        ToastManager.show(
          {
            title: intl.formatMessage({
              id: 'msg__donot_support_sending_brc20',
            }),
          },
          {
            type: 'error',
          },
        );
        return;
      }

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
  }, [accountId, appNavigation, intl, isTaproot, networkId, token]);

  const handleReceiveOnPress = useCallback(() => {
    if (!isTaproot) {
      ToastManager.show(
        {
          title: intl.formatMessage({
            id: 'msg__donot_support_receiving_brc20',
          }),
        },
        {
          type: 'error',
        },
      );
      return;
    }
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
          receiveInscription: true,
        },
      },
    });
  }, [account, appNavigation, intl, isTaproot, network, wallet]);

  const handleTransferOnPress = useCallback(() => {
    if (accountId && networkId && token) {
      if (!isTaproot) {
        ToastManager.show(
          {
            title: intl.formatMessage({
              id: 'msg__donot_support_transferring_brc20',
            }),
          },
          {
            type: 'error',
          },
        );
        return;
      }
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
  }, [accountId, appNavigation, intl, isTaproot, networkId, token]);

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

  const fetchRecycleBalance = useCallback(async () => {
    if (networkId && account && token) {
      const amountResp =
        await backgroundApiProxy.serviceBRC20.getBRC20AmountList({
          networkId,
          address: account.address,
          xpub: account.xpub ?? '',
          tokenAddress: token.tokenIdOnNetwork ?? token.address,
        });

      const recycleResp =
        await backgroundApiProxy.serviceBRC20.getBRC20RecycleBalance({
          networkId,
          address: account.address,
          xpub: account.xpub ?? '',
          tokenAddress: token.tokenIdOnNetwork ?? token.address,
          transferBalanceList: amountResp.transferBalanceList,
        });
      setRecycleBalance(recycleResp);
      setBalanceInfo({
        balance: amountResp.balance,
        availableBalance: amountResp.availableBalance,
        transferBalance: amountResp.transferBalance,
      });

      backgroundApiProxy.dispatch(
        setAccountTokensBalances({
          accountId,
          networkId,
          tokensBalance: {
            [token.tokenIdOnNetwork ?? token.address]: {
              balance: amountResp.balance,
              availableBalance: amountResp.availableBalance,
              transferBalance: amountResp.transferBalance,
            },
          },
        }),
      );
    }
  }, [account, accountId, networkId, token]);

  const fetchAvailableInscriptions = useCallback(async () => {
    if (networkId && account && token) {
      setIsLoadingInscriptions(true);
      const resp = await backgroundApiProxy.serviceBRC20.getBRC20Inscriptions({
        networkId,
        address: account.address,
        xpub: account.xpub ?? '',
        tokenAddress: token.tokenIdOnNetwork ?? token.address,
      });
      setAvailableInscriptions(resp.availableInscriptions);
      setIsLoadingInscriptions(false);
    }
  }, [account, networkId, token]);

  useOnUIEventBus(
    AppUIEventBusNames.InscriptionRecycleChanged,
    fetchRecycleBalance,
  );

  useEffect(() => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
    }
    fetchRecycleBalance();
    fetchAvailableInscriptions();
    pollingTimer = setInterval(() => {
      if (isFocused) {
        fetchRecycleBalance();
        fetchAvailableInscriptions();
      }
    }, POLLING_INTERVAL);
    return () => {
      if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
      }
    };
  }, [fetchAvailableInscriptions, fetchRecycleBalance, isFocused]);

  return (
    <ScrollView paddingY={8} paddingX={isVertical ? 4 : 8}>
      {isTaproot ? null : (
        <Alert
          dismiss={false}
          alertType="warn"
          containerProps={{ mb: 6 }}
          title={intl.formatMessage({
            id: 'msg__non_taproot_accounts_donot_support_brc20_transfers',
          })}
          description={
            <Text
              color="text-subdued"
              onPress={() => openUrl(TRANSFER_BRC20_HELP_URL)}
              typography="Body2Underline"
            >
              {intl.formatMessage({
                id: 'action__how_to_transfer_brc20_assets',
              })}
            </Text>
          }
        />
      )}

      {!isVertical ? (
        <TokenDetailHeader
          onPressSend={handleSendOnPress}
          onPressReceive={handleReceiveOnPress}
          onPressTransfer={handleTransferOnPress}
          balanceWithoutRecycle={balanceWithoutRecycle}
          isWatching={isWatching}
          style={{ mb: 8 }}
        />
      ) : null}
      <VStack mb={6} space={1}>
        <FormatBalance
          balance={balanceWithoutRecycle?.balance ?? 0}
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
            balanceWithoutRecycle?.availableBalance ?? '0'
          }`}
        </Typography.Body2>
        <Typography.Body2 color="text-subdued">
          {`${intl.formatMessage({ id: 'form__transferable_colon' })} ${
            balanceWithoutRecycle?.transferBalance ?? '0'
          }`}
        </Typography.Body2>
      </VStack>
      {isVertical ? (
        <TokenActions
          onPressSend={handleSendOnPress}
          onPressReceive={handleReceiveOnPress}
          onPressTransfer={handleTransferOnPress}
          balanceWithoutRecycle={balanceWithoutRecycle}
          style={{ mb: 6 }}
          isWatching={isWatching}
        />
      ) : null}
      {isWatching ? null : (
        <InscriptionEntry
          inscriptions={availableInscriptions}
          isLoadingInscriptions={isLoadingInscriptions}
          onPress={handleInscriptionControlOnPress}
          style={{ mb: 6 }}
        />
      )}
      <Box pb={10}>
        <TxHistoryListView
          accountId={accountId}
          networkId={networkId}
          tokenId={tokenAddress}
          tabComponent
        />
      </Box>
    </ScrollView>
  );
}

export { BRC20TokenDetail };
