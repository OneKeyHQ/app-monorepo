import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Page,
  SizableText,
  Stack,
  TextArea,
  YStack,
} from '@onekeyhq/components';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
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

// TODO(i18n): four placeholders pending keys via OneKey translation pipeline.
const COPY = {
  appNameLabel: 'Application name',
  contextLabel: 'Context (hex)',
  boundAddressLabel: 'Bound to address',
  warning:
    'A deterministic value will be derived from the address shown above using the application name and context. Anyone with the same key material, application name, and context can produce the same value. Output is bound to this exact address — a different address (different public key) will produce a different value.',
};

function DeriveContextHashModal() {
  const { $sourceInfo, walletId, accountId, networkId, payloadNonce } =
    useDappQuery<{
      walletId: string;
      accountId: string;
      networkId: string;
      payloadNonce: string;
    }>();

  // Fetch appName/context/boundAddress in-memory — they MUST stay off the
  // route params (logged via dappOpenModal). `boundAddress` is the address
  // pinned at provider entry, shown so the user verifies the exact target
  // even if BTC fresh-address has rotated since.
  // See ServiceDApp.openDeriveContextHashModal.
  const [payload, setPayload] = useState<
    { appName: string; context: string; boundAddress?: string } | undefined
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

        // Ensure password is unlocked (cached or freshly entered).
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
        // Password-sheet cancel is a transient sub-prompt cancel, not a dApp
        // rejection. Leave the modal open so the user can re-confirm. The
        // payload nonce is only consumed on success (ServiceDApp.deriveContextHash),
        // so retry works. Check className directly — OneKey errors may arrive
        // as plain serialized objects across the bg/ui boundary.
        if (
          (e as IOneKeyError)?.className ===
          EOneKeyErrorClassNames.PasswordPromptDialogCancel
        ) {
          return;
        }
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
                  {intl.formatMessage({ id: ETranslations.global_failed })}
                </SizableText>
              ) : (
                <>
                  {payload?.boundAddress ? (
                    <Stack gap="$1">
                      <SizableText size="$bodyMdMedium" color="$textSubdued">
                        {COPY.boundAddressLabel}
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
                          {payload.boundAddress}
                        </SizableText>
                      </Stack>
                    </Stack>
                  ) : null}

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
                    {/* TextArea — cross-platform scrollable read-only surface. */}
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
