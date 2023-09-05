import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import {
  Box,
  IconButton,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { isLightningNetworkByNetworkId } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../hooks';
import { TabRoutes } from '../../../routes/routesEnum';

import type { MessageDescriptor } from 'react-intl';

function LNSwapMenu({
  isSmallView,
  networkId,
}: {
  isSmallView: boolean;
  networkId: string;
}) {
  const intl = useIntl();
  const navigation = useNavigation();

  const onSwap = useCallback(
    async ({ isWithdraw }: { isWithdraw: boolean }) => {
      const isLightningNetwork = isLightningNetworkByNetworkId(networkId);
      if (!isLightningNetwork) {
        throw new Error('should be lightning network');
      }
      const isTestnet = networkId === OnekeyNetwork.tlightning;
      let inputNetworkId: string;
      let outputNetworkId: string;
      if (isWithdraw) {
        inputNetworkId = isTestnet
          ? OnekeyNetwork.tlightning
          : OnekeyNetwork.lightning;
        outputNetworkId = isTestnet ? OnekeyNetwork.tbtc : OnekeyNetwork.btc;
      } else {
        inputNetworkId = isTestnet ? OnekeyNetwork.tbtc : OnekeyNetwork.btc;
        outputNetworkId = isTestnet
          ? OnekeyNetwork.tlightning
          : OnekeyNetwork.lightning;
      }
      let token = await backgroundApiProxy.engine.getNativeTokenInfo(
        inputNetworkId,
      );
      if (token) {
        const supported = await backgroundApiProxy.serviceSwap.tokenIsSupported(
          token,
        );
        if (!supported) {
          ToastManager.show(
            {
              title: intl.formatMessage({ id: 'msg__wrong_network_desc' }),
            },
            { type: 'default' },
          );
          token = await backgroundApiProxy.engine.getNativeTokenInfo(
            OnekeyNetwork.eth,
          );
        }
        if (token) {
          backgroundApiProxy.serviceSwap.sellToken(token, false).then(() => {
            setTimeout(() => {
              backgroundApiProxy.serviceSwap.switchToNativeOutputToken(
                outputNetworkId,
              );
            }, 20);
          });
        }
      }
      navigation.getParent()?.navigate(TabRoutes.Swap);
    },
    [intl, networkId, navigation],
  );

  const options: {
    id: MessageDescriptor['id'];
    onPress: () => void;
    icon: ICON_NAMES;
  }[] = useMemo(
    () => [
      {
        id: 'action__top_up_btc',
        onPress: () => {
          onSwap({ isWithdraw: false });
        },
        icon: 'ArrowDownSolid',
      },
      {
        id: 'action__withdraw_to_btc_account',
        onPress: () => {
          onSwap({ isWithdraw: true });
        },
        icon: 'ArrowUpSolid',
      },
    ],
    [onSwap],
  );

  return (
    <Box flex={1} mx={3} minW="56px" alignItems="center">
      <BaseMenu w={220} options={options} onOpen={() => {}}>
        <IconButton
          circle
          size={isSmallView ? 'xl' : 'lg'}
          name="ArrowsRightLeftOutline"
          type="basic"
        />
      </BaseMenu>
      <Typography.CaptionStrong
        textAlign="center"
        mt="8px"
        color="text-default"
      >
        {intl.formatMessage({ id: 'title__swap' })}
      </Typography.CaptionStrong>
    </Box>
  );
}

export default LNSwapMenu;
