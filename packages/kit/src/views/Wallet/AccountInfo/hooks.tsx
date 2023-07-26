import { useCallback } from 'react';

import type { ICON_NAMES } from '@onekeyhq/components';
import type { ThemeToken } from '@onekeyhq/components/src/Provider/theme';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveSideAccount, useNavigation } from '../../../hooks';
import { useActionForAllNetworks } from '../../../hooks/useAllNetwoks';
import {
  FiatPayModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';

export type ButtonsType = (params: {
  networkId: string;
  accountId: string;
}) => {
  visible: boolean;
  isDisabled: boolean;
  process: () => unknown;
  icon: ICON_NAMES;
  text: ThemeToken;
};

export const useFiatPay = ({
  networkId,
  accountId,
  type,
}: {
  networkId: string;
  accountId: string;
  type: 'buy' | 'sell';
}): ReturnType<ButtonsType> => {
  const { wallet } = useActiveSideAccount({
    networkId,
    accountId,
  });
  const navigation = useNavigation();
  const { visible, process } = useActionForAllNetworks({
    accountId,
    networkId,
    action: useCallback(
      ({ network: n, account: a }) => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.FiatPay,
          params: {
            screen: FiatPayModalRoutes.SupportTokenListModal,
            params: {
              type,
              networkId: n.id,
              accountId: a.id,
            },
          },
        });
      },
      [navigation, type],
    ),
    filter: (p) =>
      !platformEnv.isAppleStoreEnv &&
      wallet?.type !== 'watching' &&
      !!p.network &&
      !!p.account,
  });

  return {
    visible,
    process,
    isDisabled: !visible,
    icon: 'PlusMini',
    text: 'action__buy_crypto' as ThemeToken,
  };
};

// TODO: enable buttons config
// export const useSend: ButtonsType = ({ networkId, accountId }) => {
//   const { wallet } = useActiveSideAccount({
//     networkId,
//     accountId,
//   });
//   const { sendToken } = useNavigationActions();
//
//   const { visible, process } = useActionForAllNetworks({
//     accountId,
//     networkId,
//     action: useCallback(
//       ({ network, account }) => {
//         sendToken({ networkId: network.id, accountId: account.id });
//       },
//       [sendToken],
//     ),
//     filter: (p) => wallet?.type !== 'watching' && !!p.network && !!p.account,
//   });
//
//   return {
//     visible,
//     isDisabled: !visible,
//     process,
//     icon: 'PaperAirplaneOutline',
//     text: 'action__send' as ThemeToken,
//   };
// };
//
// export const useReceive: ButtonsType = ({ networkId, accountId }) => {
//   const { wallet } = useActiveSideAccount({
//     networkId,
//     accountId,
//   });
//   const navigation = useNavigation();
//   const { visible, process } = useActionForAllNetworks({
//     networkId,
//     accountId,
//     filter: (p) => wallet?.type !== 'watching' && !!p.network && !!p.account,
//     action: useCallback(
//       ({ network: n, account: a }) => {
//         if (isLightningNetworkByImpl(n?.impl)) {
//           navigation.navigate(RootRoutes.Modal, {
//             screen: ModalRoutes.Receive,
//             params: {
//               screen: ReceiveTokenModalRoutes.CreateInvoice,
//               params: {
//                 networkId: n.id,
//                 accountId: a?.id,
//               },
//             },
//           });
//           return;
//         }
//         navigation.navigate(RootRoutes.Modal, {
//           screen: ModalRoutes.Receive,
//           params: {
//             screen: ReceiveTokenModalRoutes.ReceiveToken,
//             params: {
//               address: a.address,
//               displayAddress: a.displayAddress,
//               wallet,
//               network: n,
//               account: a,
//               template: a.template,
//             },
//           },
//         });
//       },
//       [navigation, wallet],
//     ),
//   });
//   return {
//     visible,
//     isDisabled: !visible,
//     process,
//     icon: 'QrCodeOutline',
//     text: 'action__receive' as ThemeToken,
//   };
// };
//
// export const useSwap: ButtonsType = ({ networkId, accountId }) => {
//   const intl = useIntl();
//   const navigation = useNavigation();
//
//   const { network } = useNetwork({ networkId });
//   const { wallet } = useActiveSideAccount({
//     networkId,
//     accountId,
//   });
//   const { visible, process } = useActionForAllNetworks({
//     networkId,
//     accountId,
//     filter: (p) => wallet?.type !== 'watching' && !!p.network && !!p.account,
//     action: useCallback(
//       async ({ network: n, account: a }) => {
//         if (!n || !a) {
//           return;
//         }
//         let token = await backgroundApiProxy.engine.getNativeTokenInfo(
//           n?.id ?? '',
//         );
//         if (token) {
//           const supported =
//             await backgroundApiProxy.serviceSwap.tokenIsSupported(token);
//           if (!supported) {
//             ToastManager.show(
//               {
//                 title: intl.formatMessage({ id: 'msg__wrong_network_desc' }),
//               },
//               { type: 'default' },
//             );
//             token = await backgroundApiProxy.engine.getNativeTokenInfo(
//               OnekeyNetwork.eth,
//             );
//           }
//         }
//         if (token) {
//           backgroundApiProxy.serviceSwap.sellToken(token);
//           if (a) {
//             backgroundApiProxy.serviceSwap.setSendingAccountSimple(a);
//             const paymentToken =
//               await backgroundApiProxy.serviceSwap.getPaymentToken(token);
//             if (paymentToken?.networkId === n?.id) {
//               backgroundApiProxy.serviceSwap.setRecipientToAccount(a, n);
//             }
//           }
//         }
//         navigation.getParent()?.navigate(TabRoutes.Swap);
//       },
//       [navigation, intl],
//     ),
//   });
//   return {
//     visible: visible && !network?.settings?.hiddenAccountInfoSwapOption,
//     isDisabled: !visible,
//     process,
//     icon: 'ArrowsRightLeftOutline',
//     text: 'title__swap' as ThemeToken,
//   };
// };
