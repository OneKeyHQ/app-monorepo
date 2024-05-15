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

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import { DAppAccountListStandAloneItem } from '../components/DAppAccountList';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';
import { useRiskDetection } from '../hooks/useRiskDetection';

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
    continueOperate,
    setContinueOperate,
    canContinueOperate,
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
      event?.content ?? `(${intl.formatMessage({ id: 'msg__no_content' })})`
    );
  }, [signType, event, plaintext, ciphertext, sigHash, intl]);

  const eventKindText = useMemo(() => {
    if (signType !== ENostrSignType.signEvent) {
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

  const subtitle = useMemo(() => {
    if (signType === ENostrSignType.encrypt) {
      return intl.formatMessage({
        id: 'msg__nostr_allow_website_to_encrypt_data',
      });
    }
    if (signType === ENostrSignType.decrypt) {
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

  const onSubmit = useCallback(
    async (close: () => void) => {
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
            close,
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
    ],
  );

  const renderEventDetails = useCallback(() => {
    if (!event) return null;
    return (
      <>
        <Button
          variant="secondary"
          onPress={() => setDisplayDetails(!displayDetails)}
        >
          {displayDetails ? '隐藏完整消息' : '查看完整消息'}
        </Button>
        {displayDetails ? (
          <TextArea my="$2" disabled editable={false} numberOfLines={14}>
            {JSON.stringify(event, null, 2)}
          </TextArea>
        ) : null}
      </>
    );
  }, [event, displayDetails]);

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
            {intl.formatMessage({ id: 'form__nostr_plaintext' })}:
          </SizableText>
          <TextArea disabled editable={false} numberOfLines={2}>
            {savedPlaintext}
          </TextArea>
        </YStack>
      );
    }
    return null;
  }, [intl, savedPlaintext, isDMEvent]);

  return (
    <Page scrollEnabled>
      <Page.Header headerShown={false} />
      <Page.Body>
        <DAppRequestLayout
          title="Message Signature Request"
          subtitle={subtitle}
          origin={$sourceInfo?.origin ?? ''}
          urlSecurityInfo={urlSecurityInfo}
        >
          <DAppAccountListStandAloneItem readonly />
          {/* Content Start */}
          <YStack space="$2">
            <SizableText>{eventKindText}</SizableText>
            <TextArea disabled editable={false} numberOfLines={2}>
              {content}
            </TextArea>
            {renderEncryptSignEventPlaintext()}
            {renderEventDetails()}
          </YStack>
          {signType === ENostrSignType.signEvent ? (
            <Checkbox
              label="记住我的选择，不再提示"
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
            disabled: !canContinueOperate,
          }}
          showContinueOperateCheckbox={riskLevel !== 'security'}
          riskLevel={riskLevel}
        />
      </Page.Footer>
    </Page>
  );
}

export default NostrSignEventModal;
