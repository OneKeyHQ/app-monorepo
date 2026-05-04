import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Page,
  SizableText,
  Stack,
  TextArea,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';
import { useRiskDetection } from '../hooks/useRiskDetection';

import DappOpenModalPage from './DappOpenModalPage';

// TODO(i18n): replace these placeholders with translation keys once they are
// added through the OneKey translation pipeline. This API is marked
// @experimental, so hardcoded English copy is acceptable for the first
// release behind that flag.
const COPY = {
  appNameLabel: 'Application name',
  contextLabel: 'Context (hex)',
  warning:
    'A deterministic value will be derived from your wallet using the application name and context shown above. Anyone with the same key material, application name, and context can produce the same value.',
  payloadLoadFailed:
    'Failed to load the request payload. Please cancel and try again from the application.',
};

function DeriveContextHashModal() {
  const { $sourceInfo, walletId, accountId, networkId, payloadNonce } =
    useDappQuery<{
      walletId: string;
      accountId: string;
      networkId: string;
      payloadNonce: string;
    }>();

  // appName/context are kept off the route-query JSON pipeline (see
  // ServiceDApp.openDeriveContextHashModal). DO NOT add appName/context back
  // to the route params — modal params are logged via dappOpenModal and
  // (on native) via console.log(modalParams). Fetch them in-memory here.
  const [payload, setPayload] = useState<
    { appName: string; context: string } | undefined
  >();
  const [payloadLoading, setPayloadLoading] = useState(true);
  const [payloadLoadFailed, setPayloadLoadFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void backgroundApiProxy.serviceDApp
      .getDeriveContextHashPayload(payloadNonce)
      .then((p) => {
        if (cancelled) return;
        if (!p) {
          setPayloadLoadFailed(true);
        } else {
          setPayload(p);
        }
        setPayloadLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPayloadLoadFailed(true);
        setPayloadLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [payloadNonce]);

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
  const [isLoading, setIsLoading] = useState(false);

  const title = intl.formatMessage({
    id: ETranslations.dapp_connect_signature_request,
  });

  const onConfirm = useCallback(
    async (close?: (extra?: { flag?: string }) => void) => {
      try {
        setIsLoading(true);
        const { servicePassword, serviceDApp } = backgroundApiProxy;

        // Mirror Nostr / SignMessage: ensure the user has unlocked the wallet
        // password (cached or freshly entered) before invoking the keyring.
        const cachedPassword = await servicePassword.getCachedPassword();
        if (!cachedPassword) {
          await servicePassword.promptPasswordVerifyByAccount({ accountId });
        }

        const result = await serviceDApp.deriveContextHash({
          walletId,
          accountId,
          networkId,
          payloadNonce,
        });

        await dappApprove.resolve({
          result,
          close: () => close?.({ flag: EDAppModalPageStatus.Confirmed }),
        });
      } catch (e) {
        // useDappApproveAction.reject expects { error?, close? } — passing
        // the raw Error would otherwise mask the real failure as a generic
        // user-rejection. reject() is synchronous, so no await is needed
        // (matches the pattern in NostrSignEventModal).
        const error = e instanceof Error ? e : new Error(String(e));
        dappApprove.reject({ error });
      } finally {
        setIsLoading(false);
      }
    },
    [walletId, accountId, networkId, payloadNonce, dappApprove],
  );

  return (
    <DappOpenModalPage dappApprove={dappApprove}>
      <>
        <Page.Header headerShown={false} />
        <Page.Body>
          <DAppRequestLayout
            title={title}
            origin={$sourceInfo?.origin ?? ''}
            urlSecurityInfo={urlSecurityInfo}
          >
            <YStack gap="$3" px="$5">
              {payloadLoadFailed ? (
                <SizableText size="$bodyMd" color="$textCritical">
                  {COPY.payloadLoadFailed}
                </SizableText>
              ) : (
                <>
                  <Stack gap="$1">
                    <SizableText size="$bodyMdMedium" color="$textSubdued">
                      {COPY.appNameLabel}
                    </SizableText>
                    <Stack
                      px="$3"
                      py="$2"
                      borderRadius="$2"
                      backgroundColor="$bgSubdued"
                    >
                      <SizableText
                        fontFamily="$monoRegular"
                        style={{ wordBreak: 'break-all' }}
                      >
                        {payload?.appName ?? ''}
                      </SizableText>
                    </Stack>
                  </Stack>

                  <Stack gap="$1">
                    <SizableText size="$bodyMdMedium" color="$textSubdued">
                      {COPY.contextLabel}
                    </SizableText>
                    {/*
                      TextArea (vs. a plain Stack with overflow="scroll") gives
                      us a cross-platform scrollable read-only surface. On RN
                      a Stack's `overflow: 'scroll'` would simply clip a 1KB
                      hex blob with no way to scroll.
                    */}
                    <TextArea
                      editable={false}
                      numberOfLines={8}
                      value={payload?.context ?? ''}
                    />
                  </Stack>

                  <SizableText size="$bodySm" color="$textCaution">
                    {COPY.warning}
                  </SizableText>
                </>
              )}
            </YStack>
          </DAppRequestLayout>
        </Page.Body>
        <Page.Footer>
          <DAppRequestFooter
            continueOperate={continueOperate}
            setContinueOperate={(checked) => {
              setContinueOperate(!!checked);
            }}
            onConfirm={onConfirm}
            onCancel={() => dappApprove.reject()}
            confirmButtonProps={{
              loading: isLoading,
              disabled:
                payloadLoading ||
                payloadLoadFailed ||
                !payload ||
                (showContinueOperate ? !continueOperate : false),
            }}
            showContinueOperateCheckbox={showContinueOperate}
            riskLevel={riskLevel}
          />
        </Page.Footer>
      </>
    </DappOpenModalPage>
  );
}

export default DeriveContextHashModal;
