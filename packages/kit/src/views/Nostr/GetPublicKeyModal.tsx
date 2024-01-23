import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Icon,
  Modal,
  Text,
  ToastManager,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { TxInteractInfo } from '@onekeyhq/kit/src/views/TxDetail/components/TxInteractInfo';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../hooks';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import useDappParams from '../../hooks/useDappParams';
import { useInteractWithInfo } from '../../hooks/useDecodedTx';

import { useExistNostrAccount } from './hooks/useExistNostrAccount';
import { NostrModalRoutes } from './types';

import type { NostrRoutesParams } from '../../routes';
import type { ModalScreenProps } from '../../routes/types';

type NavigationProps = ModalScreenProps<NostrRoutesParams>;

const NostrGetPublicKeyModal = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const { sourceInfo, walletId, networkId, accountId } = useDappParams();

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const interactInfo = useInteractWithInfo({ sourceInfo });

  const [isLoading, setIsLoading] = useState(false);

  const { existNostrAccount } = useExistNostrAccount({
    walletId: walletId ?? '',
    currentAccountId: accountId ?? '',
    currentNetworkId: networkId ?? '',
  });

  const closeModal = useModalClose();

  const onDone = useCallback(
    async (password: string) => {
      try {
        if (!walletId) {
          throw new Error('walletId is required');
        }
        setIsLoading(true);
        const pubkey = await backgroundApiProxy.serviceNostr.getPublicKeyHex({
          walletId,
          networkId: networkId ?? '',
          accountId: accountId ?? '',
          password,
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
    [walletId, networkId, accountId, closeModal, intl, dappApprove],
  );

  const onConfirmWithAuth = useCallback(() => {
    if (existNostrAccount) {
      onDone('');
      return;
    }

    navigation.navigate(NostrModalRoutes.NostrAuthentication, {
      walletId: walletId ?? '',
      networkId: networkId ?? '',
      accountId: accountId ?? '',
      onDone,
    });
  }, [walletId, networkId, accountId, navigation, onDone, existNostrAccount]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__nostr_request' })}
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{
        isDisabled: isLoading,
        isLoading,
      }}
      onPrimaryActionPress={() => onConfirmWithAuth()}
      secondaryActionTranslationId="action__cancel"
      onModalClose={dappApprove.reject}
      onSecondaryActionPress={({ close }) => {
        dappApprove.reject();
        close();
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
              {`${intl.formatMessage({ id: 'msg__allow_website_to' })}:`}
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
                    {intl.formatMessage({ id: 'msg__read_your_public_key' })}
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
