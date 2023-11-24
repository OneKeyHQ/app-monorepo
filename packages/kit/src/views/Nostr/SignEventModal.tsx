import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Modal,
  Text,
  ToastManager,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import {
  EventKind,
  type NostrEvent,
} from '@onekeyhq/engine/src/vaults/utils/nostr/nostr';
import { TxInteractInfo } from '@onekeyhq/kit/src/views/TxDetail/components/TxInteractInfo';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../hooks';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import useDappParams from '../../hooks/useDappParams';
import { useInteractWithInfo } from '../../hooks/useDecodedTx';

import { NostrModalRoutes } from './types';

import type { NostrRoutesParams } from '../../routes';
import type { ModalScreenProps } from '../../routes/types';

type NavigationProps = ModalScreenProps<NostrRoutesParams>;

const NostrSignEventModal = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const { sourceInfo, walletId } = useDappParams();
  const { event, pubkey, plaintext, ciphertext } = sourceInfo?.data
    .params as NostrRoutesParams[NostrModalRoutes.SignEvent];

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const interactInfo = useInteractWithInfo({ sourceInfo });

  const [isLoading, setIsLoading] = useState(false);
  const [displayDetails, setDisplayDetails] = useState(false);
  const signType = useMemo<
    'signEvent' | 'encrypt' | 'decrypt' | undefined
  >(() => {
    if (event) {
      return 'signEvent';
    }
    if (pubkey && plaintext) {
      return 'encrypt';
    }
    if (pubkey && ciphertext) {
      return 'decrypt';
    }
  }, [pubkey, plaintext, event, ciphertext]);

  const closeModal = useModalClose();

  const onDone = useCallback(
    async (password: string) => {
      try {
        if (!walletId) {
          throw new Error('walletId is required');
        }
        setIsLoading(true);
        let result: { data: NostrEvent } | { data: string } | undefined;
        if (signType === 'signEvent') {
          result = await backgroundApiProxy.serviceNostr.signEvent({
            walletId,
            password,
            event: event ?? ({} as NostrEvent),
          });
        } else if (signType === 'encrypt') {
          result = await backgroundApiProxy.serviceNostr.encrypt({
            walletId,
            password,
            pubkey: pubkey ?? '',
            plaintext: plaintext ?? '',
          });
        } else if (signType === 'decrypt') {
          result = await backgroundApiProxy.serviceNostr.decrypt({
            walletId,
            password,
            pubkey: pubkey ?? '',
            ciphertext: ciphertext ?? '',
          });
        }
        setTimeout(() => {
          dappApprove.resolve({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            result: result?.data ?? null,
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
    [
      walletId,
      closeModal,
      intl,
      dappApprove,
      event,
      pubkey,
      plaintext,
      ciphertext,
      signType,
    ],
  );

  const onConfirmWithAuth = useCallback(
    () =>
      navigation.navigate(NostrModalRoutes.NostrAuthentication, {
        walletId: walletId ?? '',
        onDone,
      }),
    [walletId, navigation, onDone],
  );

  const renderEventDetails = useMemo(
    () => (
      <>
        <Button
          type="plain"
          onPress={() => {
            setDisplayDetails(!displayDetails);
          }}
        >
          {displayDetails ? 'Hide details' : 'View details'}
        </Button>

        {displayDetails && (
          <Box
            bg="surface-default"
            borderColor="border-default"
            borderWidth={1}
            borderRadius={12}
            paddingX={4}
            paddingY={3}
            my={4}
          >
            <Text typography="Body2" color="text-subdued">
              {JSON.stringify(event, null, 2)}
            </Text>
          </Box>
        )}
      </>
    ),
    [event, displayDetails],
  );

  const [savedPlaintext, setSavedPlaintext] = useState<string | null>(null);
  const isDMEvent = useMemo(
    () => signType === 'signEvent' && Number(event?.kind) === EventKind.DM,
    [signType, event],
  );
  useEffect(() => {
    if (isDMEvent && event?.content) {
      backgroundApiProxy.serviceNostr
        .getEncryptedData(event?.content)
        .then((data) => {
          if (!data) {
            return;
          }
          if (data.plaintext) {
            setSavedPlaintext(data.plaintext);
          }
        });
    }
  }, [event, isDMEvent]);
  const renderEncryptSignEventPlaintext = useMemo(() => {
    if (
      signType === 'signEvent' &&
      Number(event?.kind) === EventKind.DM &&
      savedPlaintext &&
      savedPlaintext.length > 0
    ) {
      return (
        <Box
          bg="surface-default"
          borderColor="border-default"
          borderWidth={1}
          borderRadius={12}
          paddingX={4}
          paddingY={3}
          mb={4}
        >
          <Text mb={2} typography="Body1Strong">
            Plaintext:
          </Text>
          <Text typography="Body2" color="text-subdued">
            {savedPlaintext}
          </Text>
        </Box>
      );
    }
    return null;
  }, [signType, event, savedPlaintext]);

  const content = useMemo(() => {
    if (signType === 'encrypt') {
      return plaintext;
    }
    if (signType === 'decrypt') {
      return ciphertext;
    }
    return event?.content;
  }, [signType, event, plaintext, ciphertext]);

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
      onModalClose={() => {
        dappApprove.reject();
      }}
      onSecondaryActionPress={() => {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
        }
      }}
      height={isDMEvent ? '580px' : '500px'}
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
            <Box
              bg="surface-default"
              borderColor="border-default"
              borderWidth={1}
              borderRadius={12}
              paddingX={4}
              paddingY={3}
              my={4}
            >
              <Text mb={2} typography="Heading">
                Allow {new URL(interactInfo?.url ?? '').host} to sign content:
              </Text>
              <Text typography="Body2" color="text-subdued">
                {content}
              </Text>
            </Box>
            {renderEncryptSignEventPlaintext}
            {signType === 'signEvent' && renderEventDetails}
          </Box>
        ),
      }}
    />
  );
};

export default NostrSignEventModal;
