import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Page,
  SizableText,
  TextArea,
  YStack,
} from '@onekeyhq/components';
import {
  EEventKind,
  ENostrSignType,
  i18nSupportEventKinds,
} from '@onekeyhq/core/src/chains/nostr/types';
import type { INostrEvent } from '@onekeyhq/core/src/chains/nostr/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import { DAppAccountListStandAloneItem } from '../components/DAppAccountList';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';
import { useRiskDetection } from '../hooks/useRiskDetection';

import DappOpenModalPage from './DappOpenModalPage';

function NostrSignEventModal() {
  const {
    $sourceInfo,
    event,
    pubkey,
    plaintext,
    ciphertext,
    sigHash,
    walletId,
    accountId,
    networkId,
  } = useDappQuery<{
    event?: INostrEvent;
    pubkey?: string;
    plaintext?: string;
    ciphertext?: string;
    sigHash?: string;
    walletId: string;
    accountId: string;
    networkId: string;
  }>();

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin: $sourceInfo?.origin ?? '' });

  const intl = useIntl();
  const [displayDetails, setDisplayDetails] = useState(false);
  const [autoSign, setAutoSign] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const signType = useMemo<ENostrSignType | undefined>(() => {
    if (event) {
      return ENostrSignType.signEvent;
    }
    if (sigHash) {
      return ENostrSignType.signSchnorr;
    }
    if (pubkey && plaintext) {
      return ENostrSignType.encrypt;
    }
    if (pubkey && ciphertext) {
      return ENostrSignType.decrypt;
    }
  }, [pubkey, plaintext, event, ciphertext, sigHash]);

  const content = useMemo(() => {
    if (signType === ENostrSignType.encrypt) {
      return plaintext;
    }
    if (signType === ENostrSignType.decrypt) {
      return ciphertext;
    }
    if (signType === ENostrSignType.signSchnorr) {
      return sigHash;
    }
    return (
      event?.content ??
      `(${intl.formatMessage({
        id: ETranslations.dapp_connect_msg_no_content,
      })})`
    );
  }, [signType, event, plaintext, ciphertext, sigHash, intl]);

  const eventKindText = useMemo(() => {
    if (signType !== ENostrSignType.signEvent) {
      return '';
    }
    if (i18nSupportEventKinds.includes(Number(event?.kind))) {
      return intl.formatMessage({
        id: ETranslations[
          `dapp_connect_nostr_event_kind_${event?.kind ?? 'unknown'}`
        ],
      });
    }
    return intl.formatMessage(
      { id: ETranslations.dapp_connect_nostr_event_kind_unknown },
      { kind: event?.kind },
    );
  }, [intl, signType, event]);

  const title = useMemo(() => {
    if (signType === ENostrSignType.encrypt) {
      return intl.formatMessage({
        id: ETranslations.dapp_connect_encrypted_request,
      });
    }
    if (signType === ENostrSignType.decrypt) {
      return intl.formatMessage({
        id: ETranslations.dapp_connect_decrypted_request,
      });
    }
    return intl.formatMessage({
      id: ETranslations.dapp_connect_signature_request,
    });
  }, [intl, signType]);

  const subtitle = useMemo(() => {
    if (signType === ENostrSignType.encrypt) {
      return intl.formatMessage(
        {
          id: ETranslations.dapp_connect_allow_to_access_your_chain_encrypted_message,
        },
        {
          chain: 'Nostr',
        },
      );
    }
    if (signType === ENostrSignType.decrypt) {
      return intl.formatMessage(
        {
          id: ETranslations.dapp_connect_allow_to_access_your_chain_decrypted_message,
        },
        {
          chain: 'Nostr',
        },
      );
    }
    return intl.formatMessage(
      {
        id: ETranslations.dapp_connect_allow_to_access_your_chain_message_signature,
      },
      {
        chain:
          signType === ENostrSignType.signSchnorr ? 'Nostr Schnorr' : 'Nostr',
      },
    );
  }, [intl, signType]);

  const onSubmit = useCallback(
    async (close?: (extra?: { flag?: string }) => void) => {
      try {
        const { serviceNostr, servicePassword } = backgroundApiProxy;
        setIsLoading(true);

        // check password in memory
        const password = await servicePassword.getCachedPassword();
        if (!password) {
          await servicePassword.promptPasswordVerifyByAccount({ accountId });
        }

        let result: { data: INostrEvent } | { data: string } | undefined;
        if (signType === ENostrSignType.signEvent) {
          result = await serviceNostr.signEvent({
            event: event ?? ({} as INostrEvent),
            walletId,
            accountId,
            networkId,
            options: {
              origin: $sourceInfo?.origin ?? '',
              autoSign,
            },
          });
        } else if (signType === ENostrSignType.encrypt) {
          result = await serviceNostr.encrypt({
            pubkey: pubkey ?? '',
            plaintext: plaintext ?? '',
            walletId,
            accountId,
            networkId,
          });
        } else if (signType === ENostrSignType.decrypt) {
          result = await serviceNostr.decrypt({
            pubkey: pubkey ?? '',
            ciphertext: ciphertext ?? '',
            walletId,
            accountId,
            networkId,
          });
        } else if (signType === ENostrSignType.signSchnorr) {
          result = await serviceNostr.signSchnorr({
            sigHash: sigHash ?? '',
            walletId,
            accountId,
            networkId,
          });
        }
        console.log('====> result: ', result);
        setTimeout(() => {
          void dappApprove.resolve({
            result: result?.data ?? null,
            close: () => {
              close?.({ flag: EDAppModalPageStatus.Confirmed });
            },
          });
        }, 300);
      } catch (e) {
        dappApprove.reject();
      } finally {
        setIsLoading(false);
      }
    },
    [
      event,
      signType,
      walletId,
      accountId,
      networkId,
      dappApprove,
      pubkey,
      plaintext,
      ciphertext,
      sigHash,
      autoSign,
      $sourceInfo?.origin,
    ],
  );

  const renderEventDetails = useCallback(() => {
    if (!event) return null;
    return (
      <YStack space="$2">
        <Button
          variant="secondary"
          onPress={() => setDisplayDetails(!displayDetails)}
        >
          {displayDetails
            ? intl.formatMessage({
                id: ETranslations.dapp_connect_hide_full_message,
              })
            : intl.formatMessage({
                id: ETranslations.dapp_connect_view_full_message,
              })}
        </Button>
        {displayDetails ? (
          <TextArea editable={false} numberOfLines={11}>
            {JSON.stringify(event, null, 2)}
          </TextArea>
        ) : null}
      </YStack>
    );
  }, [intl, event, displayDetails]);

  const [savedPlaintext, setSavedPlaintext] = useState<string | null>(null);
  const isDMEvent = useMemo(
    () =>
      signType === ENostrSignType.signEvent &&
      Number(event?.kind) === EEventKind.DM,
    [signType, event],
  );
  useEffect(() => {
    if (isDMEvent && event?.content) {
      void backgroundApiProxy.serviceNostr
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
  const renderEncryptSignEventPlaintext = useCallback(() => {
    if (isDMEvent && savedPlaintext && savedPlaintext.length > 0) {
      return (
        <YStack space="$2">
          <SizableText>
            {intl.formatMessage({
              id: ETranslations.dapp_connect_nostr_plaintext,
            })}
            :
          </SizableText>
          <TextArea editable={false} numberOfLines={5}>
            {savedPlaintext}
          </TextArea>
        </YStack>
      );
    }
    return null;
  }, [intl, savedPlaintext, isDMEvent]);

  return (
    <DappOpenModalPage dappApprove={dappApprove}>
      <>
        <Page.Header headerShown={false} />
        <Page.Body>
          <DAppRequestLayout
            title={title}
            subtitle={subtitle}
            origin={$sourceInfo?.origin ?? ''}
            urlSecurityInfo={urlSecurityInfo}
          >
            <DAppAccountListStandAloneItem readonly />
            {/* Content Start */}
            <YStack space="$2">
              <SizableText>{eventKindText}</SizableText>
              <TextArea editable={false} numberOfLines={5}>
                {content}
              </TextArea>
              {renderEncryptSignEventPlaintext()}
              {renderEventDetails()}
            </YStack>
            {signType === ENostrSignType.signEvent ? (
              <Checkbox
                label={intl.formatMessage({
                  id: ETranslations.dapp_connect_do_not_ask_again,
                })}
                value={autoSign}
                onChange={(checked) => setAutoSign(!!checked)}
              />
            ) : null}
            {/* Content End  */}
          </DAppRequestLayout>
        </Page.Body>
        <Page.Footer>
          <DAppRequestFooter
            continueOperate={continueOperate}
            setContinueOperate={(checked) => {
              setContinueOperate(!!checked);
            }}
            onConfirm={onSubmit}
            onCancel={() => dappApprove.reject()}
            confirmButtonProps={{
              loading: isLoading,
              disabled: !continueOperate,
            }}
            showContinueOperateCheckbox={showContinueOperate}
            riskLevel={riskLevel}
          />
        </Page.Footer>
      </>
    </DappOpenModalPage>
  );
}

export default NostrSignEventModal;
