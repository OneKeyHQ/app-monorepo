import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';

import { IconButton, useIsVerticalLayout } from '@onekeyhq/components';
import type { ICON_NAMES } from '@onekeyhq/components';
import type { Token as TokenDO } from '@onekeyhq/engine/src/types/token';
import {
  FiatPayModalRoutes,
  ReceiveTokenModalRoutes,
  SendModalRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import BaseMenu from '../../Overlay/BaseMenu';

import type { IMenu } from '../../Overlay/BaseMenu';
import type { MessageDescriptor } from 'react-intl';

type Props = IMenu & {
  token: TokenDO | null | undefined;
  accountId: string;
  networkId: string;
  sendAddress?: string;
};
const MoreMenuButton: FC<Props> = ({
  accountId,
  networkId,
  token,
  sendAddress,
  ...props
}) => {
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation();
  const { account } = useActiveSideAccount({ networkId, accountId });

  const [buyUrl, updateBuyUrl] = useState('');
  const [sellUrl, updateSellUrl] = useState('');

  useEffect(() => {
    if (
      token?.address !== undefined &&
      token?.networkId !== undefined &&
      !platformEnv.isAppleStoreEnv
    ) {
      backgroundApiProxy.serviceFiatPay
        .getFiatPayUrl({
          type: 'buy',
          address: account?.address,
          tokenAddress: token?.address,
          networkId: token?.networkId,
        })
        .then((url) => updateBuyUrl(url));
      backgroundApiProxy.serviceFiatPay
        .getFiatPayUrl({
          type: 'sell',
          address: account?.address,
          tokenAddress: token?.address,
          networkId: token?.networkId,
        })
        .then((url) => updateSellUrl(url));
    }
  }, [account?.address, token?.address, token?.networkId, updateBuyUrl]);

  const onSend = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Send,
      params: {
        screen: SendModalRoutes.PreSendAddress,
        params: {
          accountId,
          networkId,
          from: '',
          to: '',
          amount: '',
          token: token?.tokenIdOnNetwork ?? '',
          tokenSendAddress: sendAddress,
        },
      },
    });
  }, [accountId, navigation, networkId, sendAddress, token?.tokenIdOnNetwork]);

  const onReceive = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Receive,
      params: {
        screen: ReceiveTokenModalRoutes.ReceiveToken,
        params: {},
      },
    });
  }, [navigation]);

  const goToWebView = useCallback(
    (signedUrl: string) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.FiatPay,
        params: {
          screen: FiatPayModalRoutes.MoonpayWebViewModal,
          params: {
            url: signedUrl,
          },
        },
      });
    },
    [navigation],
  );

  const options = useMemo(() => {
    const result: (
      | {
          id: MessageDescriptor['id'];
          intlValues?: Record<string | number, string>;
          onPress: () => void;
          icon: ICON_NAMES;
        }
      | false
      | undefined
    )[] = [];

    if (isVerticalLayout) {
      result.push({
        id: 'action__send',
        onPress: onSend,
        icon: 'PaperAirplaneMini',
      });
      result.push({
        id: 'action__receive',
        onPress: onReceive,
        icon: 'QrCodeMini',
      });
    }
    if (buyUrl && token) {
      result.push({
        id: 'form__buy_str_for_fiat',
        intlValues: { '0': token.symbol },
        onPress: () => {
          goToWebView(buyUrl);
        },
        icon: 'PlusMini',
      });
    }
    if (sellUrl && token) {
      result.push({
        id: 'form__sell_str_for_fiat',
        intlValues: { '0': token.symbol },
        onPress: () => {
          goToWebView(sellUrl);
        },
        icon: 'BanknotesMini',
      });
    }
    return result;
  }, [
    buyUrl,
    goToWebView,
    isVerticalLayout,
    onReceive,
    onSend,
    sellUrl,
    token,
  ]);

  const Tigger = useMemo(() => {
    const isDisabled = options.length === 0;
    if (isVerticalLayout) {
      return (
        <IconButton
          size="base"
          name="EllipsisHorizontalOutline"
          isDisabled={isDisabled}
        />
      );
    }
    return (
      <IconButton
        circle
        size="base"
        name="EllipsisHorizontalOutline"
        isDisabled={isDisabled}
      />
    );
  }, [isVerticalLayout, options.length]);

  return (
    <BaseMenu w={190} options={options} {...props}>
      {Tigger}
    </BaseMenu>
  );
};

export default MoreMenuButton;
