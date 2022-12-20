import { useCallback, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Icon, Image, Modal, Typography } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import swftLogoPNG from '../../../../assets/swft_logo.png';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { HistoryRequestRoutes } from '../../Help/Request/types';
import Transaction from '../components/Transaction';
import { swftcCustomerSupportUrl } from '../config';
import { useWalletsSwapTransactions } from '../hooks/useTransactions';
import { SwapRoutes } from '../typings';

import type { SwapRoutesParams } from '../typings';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.Transaction>;

const TransactionModal = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const intl = useIntl();
  const transactions = useWalletsSwapTransactions();
  const { txid } = route.params;
  const tx = transactions.filter((s) => s.hash === txid)[0];

  const onOpenCustomerSupport = useCallback(() => {
    if (tx.quoterType === 'swftc') {
      if (platformEnv.isNative) {
        const swftcOrderId =
          tx.attachment?.swftcOrderId ?? tx.thirdPartyOrderId;
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
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.HistoryRequest,
        params: {
          screen: HistoryRequestRoutes.SubmitRequestModal,
        },
      });
    }
  }, [navigation, tx]);
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

  const secondaryActionProps = useMemo(() => {
    if (tx.quoterType !== 'swftc') {
      return {
        leftIconName: 'ChatBubbleLeftEllipsisMini' as const,
        onPress: onOpenCustomerSupport,
      };
    }
    return {
      onPress: onOpenCustomerSupport,
      children: (
        <Box flexDirection="row" alignItems="center">
          <Box w="5" h="5">
            <Image w="5" h="5" source={swftLogoPNG} />
            <Box
              position="absolute"
              bg="surface-neutral-default"
              bottom={-4}
              right={-4}
              borderRadius="full"
            >
              <Icon name="ChatBubbleLeftEllipsisMini" size={14} />
            </Box>
          </Box>
          <Typography.Button1 ml="2">
            {intl.formatMessage({ id: 'action__support' })}
          </Typography.Button1>
        </Box>
      ),
    };
  }, [tx, intl, onOpenCustomerSupport]);
  return (
    <Modal
      hidePrimaryAction={!platformEnv.isNative}
      scrollViewProps={{
        children: <Transaction tx={tx} showViewInBrowser />,
      }}
      primaryActionTranslationId="action__share"
      primaryActionProps={{
        leftIconName: 'ShareMini',
        type: 'basic',
        onPress: onShare,
      }}
      secondaryActionTranslationId="action__support"
      secondaryActionProps={secondaryActionProps}
    />
  );
};

export default TransactionModal;
