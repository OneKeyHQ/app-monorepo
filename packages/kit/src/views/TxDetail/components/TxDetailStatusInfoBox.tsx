import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import dayjs from 'dayjs';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Image,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { IDecodedTxStatus } from '@onekeyhq/engine/src/vaults/types';
import txFailedIcon from '@onekeyhq/kit/assets/transaction/status/tx_failed.png';
import txPendingIcon from '@onekeyhq/kit/assets/transaction/status/tx_pending.png';
import txSuccessedIcon from '@onekeyhq/kit/assets/transaction/status/tx_successed.png';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { isLightningNetworkByNetworkId } from '@onekeyhq/shared/src/engine/engineConsts';

import { TabRoutes } from '../../../routes/routesEnum';
import BaseMenu from '../../Overlay/BaseMenu';
import { getTxStatusInfo } from '../utils/utilsTxDetail';

import type { TabRoutesParams } from '../../../routes/types';
import type { IBaseMenuOptions } from '../../Overlay/BaseMenu';
import type { ITxActionListViewProps } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ImageURISource } from 'react-native';

type Props = ITxActionListViewProps & {
  tokensInTx: Token[];
};

type NavigationProps = NativeStackNavigationProp<TabRoutesParams>;

function TxDetailStatusInfoBox(props: Props) {
  const { decodedTx, isSendConfirm, tokensInTx } = props;

  console.log(decodedTx);

  const navigation = useNavigation<NavigationProps>();

  const intl = useIntl();

  const { text } = getTxStatusInfo({ decodedTx });

  const statusIcon = useMemo(() => {
    if (decodedTx.status === IDecodedTxStatus.Pending) {
      return txPendingIcon as ImageURISource;
    }

    if (decodedTx.status === IDecodedTxStatus.Confirmed) {
      return txSuccessedIcon as ImageURISource;
    }

    return txFailedIcon as ImageURISource;
  }, [decodedTx.status]);

  const handleToSwapOnPress = useCallback(
    async (token: Token) => {
      let checkToken = token;
      if (checkToken) {
        const supported = await backgroundApiProxy.serviceSwap.tokenIsSupported(
          checkToken,
        );
        if (!supported) {
          ToastManager.show(
            {
              title: intl.formatMessage({ id: 'msg__wrong_network_desc' }),
            },
            { type: 'default' },
          );
          checkToken = await backgroundApiProxy.engine.getNativeTokenInfo(
            OnekeyNetwork.eth,
          );
        }
      }
      backgroundApiProxy.serviceSwap.sellToken(checkToken);
      navigation.navigate(TabRoutes.Swap);
    },
    [intl, navigation],
  );

  const swapOptions = useMemo(() => {
    const baseOptions: IBaseMenuOptions = tokensInTx.map((token) => ({
      textValue: token?.symbol ?? '',
      onPress: () => handleToSwapOnPress(token),
    }));
    return baseOptions;
  }, [handleToSwapOnPress, tokensInTx]);

  const isLightningNetwork = isLightningNetworkByNetworkId(decodedTx.networkId);

  if (isSendConfirm) return null;

  return (
    <Box mb={6}>
      <HStack justifyContent="space-between" alignItems="center">
        <HStack space={2} alignItems="center">
          <Image size={10} source={statusIcon} />
          <Box>
            <Text typography="Body1Strong">
              {intl.formatMessage({ id: text })}
            </Text>
            {(decodedTx.createdAt || decodedTx.updatedAt) && (
              <Text typography="Body2" color="text-subdued">
                {dayjs(decodedTx.createdAt || decodedTx.updatedAt).format(
                  'MMM DD YYYY, HH:mm',
                )}
              </Text>
            )}
          </Box>
        </HStack>
        {tokensInTx.length === 1 && !isLightningNetwork && (
          <Button
            size="sm"
            type="basic"
            onPress={() => handleToSwapOnPress(tokensInTx[0])}
          >
            {intl.formatMessage({ id: 'title__swap' })}
          </Button>
        )}
        {tokensInTx.length > 1 && (
          <BaseMenu options={swapOptions}>
            <Button size="sm" type="basic">
              {intl.formatMessage({ id: 'title__swap' })}
            </Button>
          </BaseMenu>
        )}
      </HStack>
    </Box>
  );
}

export { TxDetailStatusInfoBox };
