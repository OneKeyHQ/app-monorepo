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
import { DAppAccountListStandAloneItemReadonly } from '../components/DAppAccountList';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';
import { useRiskDetection } from '../hooks/useRiskDetection';

import DappOpenModalPage from './DappOpenModalPage';

// TODO(i18n): three placeholders pending keys via OneKey translation pipeline.
const COPY = {
  appNameLabel: 'Application name',
  contextLabel: 'Context (hex)',
  warning:
    'A deterministic value will be derived from your wallet using the application name and context shown above. Anyone with the same key material, application name, and context can produce the same value. Note: for HD (mnemonic) wallets the value is the same across all BTC accounts under the same wallet seed (recovery phrase together with any BIP-39 passphrase set at wallet creation).',
};

function DeriveContextHashModal() {
  const { $sourceInfo, walletId, accountId, networkId, payloadNonce } =
    useDappQuery<{
      walletId: string;
      accountId: string;
      networkId: string;
      payloadNonce: string;
    }>();

  // Fetch appName/context in-memory — they MUST stay off the route params
  // (logged via dappOpenModal). See ServiceDApp.openDeriveContextHashModal.
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
        // reject() expects { error?, close? }; raw Error would mask as user-rejection.
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
            <DAppAccountListStandAloneItemReadonly
              accountId={accountId}
              networkId={networkId}
            />
            <YStack gap="$3" px="$5">
              {payloadLoadFailed ? (
                <SizableText size="$bodyMd" color="$textCritical">
                  {intl.formatMessage({ id: ETranslations.global_failed })}
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
