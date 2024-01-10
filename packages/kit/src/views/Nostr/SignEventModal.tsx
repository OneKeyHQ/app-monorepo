import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  CheckBox,
  Modal,
  Text,
  ToastManager,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import {
  ESignType,
  EventKind,
  type NostrEvent,
  i18nSupportEventKinds,
} from '@onekeyhq/engine/src/vaults/impl/nostr/helper/types';
import { TxInteractInfo } from '@onekeyhq/kit/src/views/TxDetail/components/TxInteractInfo';
import { isHdWallet as isHdWalletFn } from '@onekeyhq/shared/src/engine/engineUtils';

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

  const { sourceInfo, walletId, networkId, accountId } = useDappParams();
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

  const isHdWallet = isHdWalletFn({ walletId: walletId ?? '' });
  const interactInfo = useInteractWithInfo({ sourceInfo });

  const [autoSign, setAutoSign] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [displayDetails, setDisplayDetails] = useState(false);
  const signType = useMemo<ESignType | undefined>(() => {
    if (event) {
      return ESignType.signEvent;
    }
    if (sigHash) {
      return ESignType.signSchnorr;
    }
    if (pubkey && plaintext) {
      return ESignType.encrypt;
    }
    if (pubkey && ciphertext) {
      return ESignType.decrypt;
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
        if (signType === ESignType.signEvent) {
          result = await backgroundApiProxy.serviceNostr.signEvent({
            walletId,
            networkId: networkId ?? '',
            accountId: accountId ?? '',
            password,
            event: event ?? ({} as NostrEvent),
            options: isHdWallet
              ? {
                  host: sourceInfo?.hostname ?? '',
                  autoSign,
                }
              : undefined,
          });
        } else if (signType === ESignType.encrypt) {
          result = await backgroundApiProxy.serviceNostr.encrypt({
            walletId,
            networkId: networkId ?? '',
            accountId: accountId ?? '',
            password,
            pubkey: pubkey ?? '',
            plaintext: plaintext ?? '',
          });
        } else if (signType === ESignType.decrypt) {
          result = await backgroundApiProxy.serviceNostr.decrypt({
            walletId,
            networkId: networkId ?? '',
            accountId: accountId ?? '',
            password,
            pubkey: pubkey ?? '',
            ciphertext: ciphertext ?? '',
          });
        } else if (signType === ESignType.signSchnorr) {
          result = await backgroundApiProxy.serviceNostr.signSchnorr({
            walletId,
            networkId: networkId ?? '',
            accountId: accountId ?? '',
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
      networkId,
      accountId,
      closeModal,
      intl,
      dappApprove,
      event,
      pubkey,
      plaintext,
      ciphertext,
      sigHash,
      signType,
      autoSign,
      sourceInfo?.hostname,
      isHdWallet,
    ],
  );

  const onConfirmWithAuth = useCallback(
    () =>
      navigation.navigate(NostrModalRoutes.NostrAuthentication, {
        walletId: walletId ?? '',
        networkId: networkId ?? '',
        accountId: accountId ?? '',
        onDone,
      }),
    [walletId, networkId, accountId, navigation, onDone],
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
    () =>
      signType === ESignType.signEvent && Number(event?.kind) === EventKind.DM,
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
      signType === ESignType.signEvent &&
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
    if (signType === ESignType.encrypt) {
      return plaintext;
    }
    if (signType === ESignType.decrypt) {
      return ciphertext;
    }
    if (signType === ESignType.signSchnorr) {
      return sigHash;
    }
    return (
      event?.content ?? `(${intl.formatMessage({ id: 'msg__no_content' })})`
    );
  }, [signType, event, plaintext, ciphertext, sigHash, intl]);

  const eventKindText = useMemo(() => {
    if (signType !== ESignType.signEvent) {
      return '';
    }
    if (i18nSupportEventKinds.includes(Number(event?.kind))) {
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
    if (signType === ESignType.encrypt) {
      return intl.formatMessage({
        id: 'msg__nostr_allow_website_to_encrypt_data',
      });
    }
    if (signType === ESignType.decrypt) {
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
      height={isDMEvent ? '580px' : '500px'}
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          paddingVertical: isVerticalLayout ? 16 : 24,
        },
        children: (
          <Box h="full" flexDirection="column" justifyContent="space-between">
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
              {signType === ESignType.signEvent && renderEventDetails}
            </Box>

            {signType === ESignType.signEvent && isHdWallet && (
              <Box alignItems="center" flexDirection="row">
                <CheckBox
                  containerStyle={{ mr: 2 }}
                  isChecked={autoSign}
                  onChange={setAutoSign}
                />
                <Text>
                  {intl.formatMessage({
                    id: 'content__remember_my_choice_and_dont_ask_again',
                  })}
                </Text>
              </Box>
            )}
          </Box>
        ),
      }}
    />
  );
};

export default NostrSignEventModal;
