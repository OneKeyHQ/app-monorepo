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
  SupportEventKinds,
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
  let sigHash: string | undefined;
  let event: NostrEvent | undefined;
  let pubkey: string | undefined;
  let plaintext: string | undefined;
  let ciphertext: string | undefined;
  // For SignSchnorr
  if (typeof sourceInfo?.data.params === 'string') {
    sigHash = sourceInfo?.data.params;
  } else {
    const params = sourceInfo?.data
      .params as NostrRoutesParams[NostrModalRoutes.SignEvent];
    event = params.event;
    pubkey = params.pubkey;
    plaintext = params.plaintext;
    ciphertext = params.ciphertext;
  }

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const interactInfo = useInteractWithInfo({ sourceInfo });

  const [isLoading, setIsLoading] = useState(false);
  const [displayDetails, setDisplayDetails] = useState(false);
  const signType = useMemo<
    'signEvent' | 'signSchnorr' | 'encrypt' | 'decrypt' | undefined
  >(() => {
    if (event) {
      return 'signEvent';
    }
    if (sigHash) {
      return 'signSchnorr';
    }
    if (pubkey && plaintext) {
      return 'encrypt';
    }
    if (pubkey && ciphertext) {
      return 'decrypt';
    }
  }, [pubkey, plaintext, event, ciphertext, sigHash]);

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
        } else if (signType === 'signSchnorr') {
          result = await backgroundApiProxy.serviceNostr.signSchnorr({
            walletId,
            password,
            sigHash: sigHash ?? '',
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
      sigHash,
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
          {displayDetails
            ? intl.formatMessage({ id: 'action__hide_details' })
            : intl.formatMessage({ id: 'action__view_details' })}
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
    [intl, event, displayDetails],
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
            {intl.formatMessage({ id: 'form__nostr_plaintext' })}:
          </Text>
          <Text typography="Body2" color="text-subdued">
            {savedPlaintext}
          </Text>
        </Box>
      );
    }
    return null;
  }, [intl, signType, event, savedPlaintext]);

  const content = useMemo(() => {
    if (signType === 'encrypt') {
      return plaintext;
    }
    if (signType === 'decrypt') {
      return ciphertext;
    }
    if (signType === 'signSchnorr') {
      return sigHash;
    }
    return (
      event?.content ?? `(${intl.formatMessage({ id: 'msg__no_content' })})`
    );
  }, [signType, event, plaintext, ciphertext, sigHash, intl]);

  const eventKindText = useMemo(() => {
    if (signType !== 'signEvent') {
      return '';
    }
    if (SupportEventKinds.includes(Number(event?.kind))) {
      return intl.formatMessage({
        id: `msg__nostr_event_kind_${event?.kind ?? 'unknown'}`,
      } as any);
    }
    return intl.formatMessage(
      { id: 'msg__nostr_event_kind_unknown' },
      { kind: event?.kind },
    );
  }, [intl, signType, event]);

  const signText = useMemo(() => {
    if (signType === 'encrypt') {
      return intl.formatMessage({
        id: 'msg__nostr_allow_website_to_encrypt_data',
      });
    }
    if (signType === 'decrypt') {
      return intl.formatMessage({
        id: 'msg__nostr_allow_website_to_decrypt_data',
      });
    }
    return intl.formatMessage(
      {
        id: 'msg__allow_sign_event',
      },
      {
        kind: eventKindText,
      },
    );
  }, [intl, signType, eventKindText]);

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
                {signText}
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
