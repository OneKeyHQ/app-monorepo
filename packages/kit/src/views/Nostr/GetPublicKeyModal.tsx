import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { ICON_NAMES } from '@onekeyhq/components';
import {
  Box,
  Center,
  Divider,
  HStack,
  Icon,
  Modal,
  Text,
  ToastManager,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import type { LNURLAuthServiceResponse } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/lnurl';
import { TxInteractInfo } from '@onekeyhq/kit/src/views/TxDetail/components/TxInteractInfo';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccount, useNavigation } from '../../hooks';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import useDappParams from '../../hooks/useDappParams';
import { useInteractWithInfo } from '../../hooks/useDecodedTx';
import { SendModalRoutes } from '../Send/enums';

import { NostrModalRoutes } from './types';

import type { NostrRoutesParams } from '../../routes';
import type { ModalScreenProps } from '../../routes/types';
import type { LnUrlAuthenticationParams } from '../Send/types';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<NostrRoutesParams>;
type RouteProps = RouteProp<NostrRoutesParams, NostrModalRoutes.GetPublicKey>;

const NostrGetPublicKeyModal = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const { sourceInfo, walletId, networkId, accountId } = useDappParams();

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const interactInfo = useInteractWithInfo({ sourceInfo });

  const [isLoading, setIsLoading] = useState(false);

  const closeModal = useModalClose();

  const onDone = useCallback(
    async (password: string) => {
      try {
        if (!walletId) {
          throw new Error('walletId is required');
        }
        setIsLoading(true);
        const pubkey = await backgroundApiProxy.serviceNostr.getPublicKey({
          walletId,
          password,
        });
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__success' }),
        });
        setTimeout(() => {
          dappApprove.resolve({
            result: pubkey,
            close: closeModal,
          });
        }, 300);
      } catch (e: any) {
        const { key, info } = e;
        if (key && key !== 'onekey_error') {
          ToastManager.show(
            {
              title: intl.formatMessage(
                {
                  id: key,
                },
                info ?? {},
              ),
            },
            { type: 'error' },
          );
        } else {
          ToastManager.show(
            { title: (e as Error)?.message || e },
            { type: 'error' },
          );
        }
        dappApprove.reject();
      } finally {
        setIsLoading(false);
      }
    },
    [walletId, closeModal, intl, dappApprove],
  );

  const onConfirmWithAuth = useCallback(
    () =>
      navigation.navigate(NostrModalRoutes.NostrAuthentication, {
        walletId: walletId ?? '',
        onDone,
      }),
    [walletId, navigation, onDone],
  );

  return (
    <Modal
      header="Nostr"
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{
        isDisabled: isLoading,
        isLoading,
      }}
      onPrimaryActionPress={() => onConfirmWithAuth()}
      secondaryActionTranslationId="action__cancel"
      onSecondaryActionPress={() => {
        dappApprove.reject();
      }}
      height="auto"
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          paddingVertical: isVerticalLayout ? 16 : 24,
        },
        children: (
          <Box>
            <TxInteractInfo
              origin={interactInfo?.url ?? ''}
              name={interactInfo?.name}
              icon={interactInfo?.icons[0]}
              networkId=""
              mb={0}
            />
            <Text my={4} typography="Heading">
              Allow this website to:
            </Text>
            <Box py={4}>
              <VStack space={4}>
                <HStack alignItems="center">
                  <Center
                    bgColor="surface-success-subdued"
                    borderRadius="full"
                    width={9}
                    height={9}
                  >
                    <Icon size={20} color="icon-success" name="CheckSolid" />
                  </Center>

                  <Text ml={4} typography="Body1" color="text-default">
                    Read your public key
                  </Text>
                </HStack>
              </VStack>
            </Box>
          </Box>
        ),
      }}
    />
  );
};

export default NostrGetPublicKeyModal;
