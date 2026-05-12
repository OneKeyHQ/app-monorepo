import { useCallback, useEffect, useRef, useState } from 'react';

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
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
import useAppNavigation from '../../../hooks/useAppNavigation';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';
import { useRiskDetection } from '../hooks/useRiskDetection';

import DappOpenModalPage from './DappOpenModalPage';

const EXPIRED_ERROR_MESSAGE =
  'deriveContextHash request expired, please retry from the site';

const COPY = {
  accountLabel: 'Bound to account',
  networkLabel: 'Network',
  appNameLabel: 'Application name',
  contextLabel: 'Context (hex)',
  warning:
    'A deterministic value will be derived from this BTC account using the application name and context. Anyone with the same key material, application name, and context, on the same network, can produce the same value.',
};

function networkLabelFromId(networkId: string): string {
  switch (networkId) {
    case 'btc--0':
      return 'Bitcoin Mainnet';
    case 'tbtc--0':
      return 'Bitcoin Testnet';
    case 'tbtc--1':
      return 'Bitcoin Signet';
    default:
      return networkId;
  }
}

function DeriveContextHashModal() {
  const { $sourceInfo, nonce } = useDappQuery<{ nonce: string }>();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const [payload, setPayload] = useState<
    | {
        appName: string;
        context: string;
        address: string;
        networkId: string;
      }
    | undefined
  >();
  const [payloadLoading, setPayloadLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const completedRef = useRef(false);

  const rejectExpiredAndClose = useCallback(() => {
    // Staged entry gone (TTL evicted or bg restarted) — close the modal even if reject is a no-op.
    dappApprove.reject({
      error: web3Errors.provider.custom({
        code: -32_000,
        message: EXPIRED_ERROR_MESSAGE,
      }),
      close: () => navigation.pop(),
    });
  }, [dappApprove, navigation]);

  useEffect(() => {
    let cancelled = false;
    void backgroundApiProxy.serviceDApp
      .peekDeriveContextHashRequest(nonce)
      .then((p) => {
        if (cancelled) return;
        if (!p) {
          rejectExpiredAndClose();
          return;
        }
        setPayload(p);
        setPayloadLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        rejectExpiredAndClose();
      });
    return () => {
      cancelled = true;
    };
  }, [nonce, rejectExpiredAndClose]);

  // Belt-and-suspenders cleanup; the TTL sweep also bounds retention.
  useEffect(() => {
    return () => {
      if (!completedRef.current) {
        void backgroundApiProxy.serviceDApp.completeDeriveContextHashRequest(
          nonce,
        );
      }
    };
  }, [nonce]);

  const {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin: $sourceInfo?.origin ?? '' });

  const title = intl.formatMessage({
    id: ETranslations.dapp_connect_signature_request,
  });

  const onConfirm = useCallback(
    async (close?: (extra?: { flag?: string }) => void) => {
      try {
        setIsLoading(true);
        const result =
          await backgroundApiProxy.serviceDApp.executeDeriveContextHash({
            nonce,
          });
        completedRef.current = true;
        await dappApprove.resolve({
          result,
          close: () => close?.({ flag: EDAppModalPageStatus.Confirmed }),
        });
      } catch (e) {
        // Password-prompt cancel: keep modal open so user can retry.
        if (
          (e as IOneKeyError)?.className ===
          EOneKeyErrorClassNames.PasswordPromptDialogCancel
        ) {
          return;
        }
        // Staged entry gone between mount and confirm — close, don't strand the user.
        if (
          typeof (e as { message?: unknown })?.message === 'string' &&
          (e as { message: string }).message.includes(EXPIRED_ERROR_MESSAGE)
        ) {
          rejectExpiredAndClose();
          return;
        }
        const error = e instanceof Error ? e : new Error(String(e));
        dappApprove.reject({
          error,
          close: () => close?.(),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [nonce, dappApprove, rejectExpiredAndClose],
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
              <Stack gap="$1">
                <SizableText size="$bodyMdMedium" color="$textSubdued">
                  {COPY.accountLabel}
                </SizableText>
                <Stack
                  px="$3"
                  py="$2"
                  borderRadius="$2"
                  backgroundColor="$bgSubdued"
                >
                  <SizableText
                    color="$text"
                    fontFamily="$monoRegular"
                    style={{ wordBreak: 'break-all' }}
                  >
                    {payload?.address ?? ''}
                  </SizableText>
                </Stack>
              </Stack>

              <Stack gap="$1">
                <SizableText size="$bodyMdMedium" color="$textSubdued">
                  {COPY.networkLabel}
                </SizableText>
                <Stack
                  px="$3"
                  py="$2"
                  borderRadius="$2"
                  backgroundColor="$bgSubdued"
                >
                  <SizableText color="$text">
                    {payload ? networkLabelFromId(payload.networkId) : ''}
                  </SizableText>
                </Stack>
              </Stack>

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
                    color="$text"
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
                <TextArea
                  editable={false}
                  numberOfLines={8}
                  value={payload?.context ?? ''}
                />
              </Stack>

              <SizableText size="$bodySm" color="$textCaution">
                {COPY.warning}
              </SizableText>
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
