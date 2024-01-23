import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import { Box, IconButton, Typography } from '@onekeyhq/components';
import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { isLightningNetworkByNetworkId } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccount, useNavigation, useNetwork } from '../../../hooks';
import { TabRoutes } from '../../../routes/routesEnum';
import { setRecipient } from '../../../store/reducers/swap';

import type { MessageDescriptor } from 'react-intl';

function LNSwapMenu({
  isSmallView,
  networkId,
  accountId,
}: {
  isSmallView: boolean;
  networkId: string;
  accountId: string;
}) {
  const intl = useIntl();
  const navigation = useNavigation();
  const { account } = useAccount({ accountId, networkId });
  const { network } = useNetwork({ networkId });

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
      await backgroundApiProxy.serviceSwap.setNativInputAndOutputToken(
        inputNetworkId,
        outputNetworkId,
      );
      if (account) {
        if (isWithdraw) {
          backgroundApiProxy.serviceSwap.setSendingAccountSimple(account);
        } else if (network?.id && account) {
          const lnurlMap =
            await backgroundApiProxy.serviceLightningNetwork.batchGetLnUrlByAccounts(
              {
                networkId: network.id,
                accounts: [account],
              },
            );
          const address = lnurlMap[account.id] ?? account.address;
          const data = {
            address,
            name: account.name,
            accountId: account.id,
            networkId: network.id,
            networkImpl: network.impl,
          };
          backgroundApiProxy.dispatch(setRecipient(data));
        }
      }
      navigation.getParent()?.navigate(TabRoutes.Swap);
    },
    [networkId, navigation, account, network],
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
      <BaseMenu options={options} menuWidth={280}>
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
