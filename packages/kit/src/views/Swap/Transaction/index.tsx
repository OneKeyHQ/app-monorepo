import React, { useCallback } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Modal } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveWalletAccount } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { HistoryRequestRoutes } from '../../Help/Request/types';
import Transaction from '../components/Transaction';
import { swftcCustomerSupportUrl } from '../config';
import { useAllTransactions } from '../hooks/useTransactions';
import { SwapRoutes, SwapRoutesParams, TransactionDetails } from '../typings';

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.Transaction>;

const TransactionModal = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const { accountId } = useActiveWalletAccount();
  const transactions = useAllTransactions(accountId);
  const { txid } = route.params;
  const tx = transactions.filter((s) => s.hash === txid)[0];

  const onOpenCustomerSupport = useCallback(
    (transaction: TransactionDetails) => {
      if (transaction.quoterType === 'swftc') {
        if (platformEnv.isNative) {
          const swftcOrderId =
            transaction.attachment?.swftcOrderId ??
            transaction.thirdPartyOrderId;
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Swap,
            params: {
              screen: SwapRoutes.SwftcHelp,
              params: {
                orderid: swftcOrderId ?? '',
              },
            },
          });
        } else {
          global.open(swftcCustomerSupportUrl, '_blank');
        }
      } else {
        const parent = navigation.getParent() ?? navigation;
        parent.goBack();
        setTimeout(() => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.HistoryRequest,
            params: {
              screen: HistoryRequestRoutes.SubmitRequestModal,
            },
          });
        }, 10);
      }
    },
    [navigation],
  );
  const onShare = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.Share,
        params: {
          txid,
        },
      },
    });
  }, [navigation, txid]);
  return (
    <Modal
      hidePrimaryAction={!platformEnv.isNative}
      scrollViewProps={{
        children: <Transaction tx={tx} showViewInBrowser />,
      }}
      secondaryActionTranslationId="action__support"
      primaryActionProps={{
        leftIconName: 'ShareSolid',
        type: 'basic',
        onPress: onShare,
      }}
      primaryActionTranslationId="action__share"
      secondaryActionProps={{
        leftIconName: 'CustomerSupportOutline',
        onPress: () => onOpenCustomerSupport(tx),
      }}
    />
  );
};

export default TransactionModal;
