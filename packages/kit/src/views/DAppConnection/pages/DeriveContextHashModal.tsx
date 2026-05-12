import { useCallback, useEffect, useRef, useState } from 'react';

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Divider,
  Page,
  SizableText,
  Stack,
  TextArea,
  YGroup,
  YStack,
} from '@onekeyhq/components';
import { NetworkSelectorTriggerDappConnectionCmp } from '@onekeyhq/kit/src/components/AccountSelector';
import { AccountSelectorTriggerDappConnectionCmp } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerDApp';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';
import { useRiskDetection } from '../hooks/useRiskDetection';

import DappOpenModalPage from './DappOpenModalPage';

const EXPIRED_ERROR_MESSAGE =
  'deriveContextHash request expired, please retry from the site';

function DeriveContextHashAccountItem({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const intl = useIntl();
  const { result, isLoading } = usePromiseResult(async () => {
    const [network, account, wallet] = await Promise.all([
      backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId }),
      backgroundApiProxy.serviceAccount.getAccount({ accountId, networkId }),
      backgroundApiProxy.serviceAccount.getWallet({
        walletId: accountUtils.getWalletIdFromAccountId({ accountId }),
      }),
    ]);
    let indexedAccount: IDBIndexedAccount | undefined;
    if (account.indexedAccountId) {
      indexedAccount =
        await backgroundApiProxy.serviceAccount.getIndexedAccount({
          id: account.indexedAccountId,
        });
    }
    return { network, account, wallet, indexedAccount };
  }, [networkId, accountId]);

  return (
    <YStack gap="$2">
      <SizableText size="$headingMd" color="$text">
        {intl.formatMessage({ id: ETranslations.global_accounts })}
      </SizableText>
      <YGroup
        bg="$bg"
        borderRadius="$3"
        borderColor="$borderSubdued"
        borderWidth={StyleSheet.hairlineWidth}
        separator={<Divider />}
        disabled
        overflow="hidden"
      >
        <YGroup.Item>
          <NetworkSelectorTriggerDappConnectionCmp
            isLoading={isLoading}
            network={result?.network}
            triggerDisabled
          />
        </YGroup.Item>
        <YGroup.Item>
          <AccountSelectorTriggerDappConnectionCmp
            isLoading={isLoading}
            account={result?.account}
            wallet={result?.wallet}
            indexedAccount={result?.indexedAccount}
            triggerDisabled
          />
        </YGroup.Item>
      </YGroup>
    </YStack>
  );
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
        accountId: string;
      }
    | undefined
  >();
  const [payloadLoading, setPayloadLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const completedRef = useRef(false);

  // `useDappApproveAction` returns a fresh `{ reject, resolve }` object on every
  // render, so anything depending on `dappApprove` reference loops with setState.
  // Keep the latest reject-and-close behind a ref so the peek effect can run
  // exactly once per nonce.
  const rejectExpiredAndCloseRef = useRef<() => void>(() => undefined);
  rejectExpiredAndCloseRef.current = () => {
    // Staged entry gone (TTL evicted or bg restarted) — close the modal even if reject is a no-op.
    dappApprove.reject({
      error: web3Errors.provider.custom({
        code: -32_000,
        message: EXPIRED_ERROR_MESSAGE,
      }),
      close: () => navigation.pop(),
    });
  };

  useEffect(() => {
    let cancelled = false;
    void backgroundApiProxy.serviceDApp
      .peekDeriveContextHashRequest(nonce)
      .then((p) => {
        if (cancelled) return;
        if (!p) {
          rejectExpiredAndCloseRef.current();
          return;
        }
        setPayload(p);
        setPayloadLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        rejectExpiredAndCloseRef.current();
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

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
    id: ETranslations.dapp_connect_derive_context_hash_request__title,
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
          rejectExpiredAndCloseRef.current();
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
    [nonce, dappApprove],
  );

  return (
    <DappOpenModalPage dappApprove={dappApprove}>
      <>
        <Page.Header headerShown={false} />
        <Page.Body>
          <DAppRequestLayout
            title={title}
            subtitleShown={false}
            origin={$sourceInfo?.origin ?? ''}
            urlSecurityInfo={urlSecurityInfo}
          >
            {payload ? (
              <DeriveContextHashAccountItem
                accountId={payload.accountId}
                networkId={payload.networkId}
              />
            ) : null}
            <YStack gap="$3">
              <Stack gap="$1">
                <SizableText size="$bodyMdMedium" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.dapp_connect_derive_context_hash_app_name__title,
                  })}
                </SizableText>
                <Stack
                  px="$3"
                  py="$2"
                  borderRadius="$2"
                  backgroundColor="$bgSubdued"
                >
                  <SizableText color="$text" style={{ wordBreak: 'break-all' }}>
                    {payload?.appName ?? ''}
                  </SizableText>
                </Stack>
              </Stack>

              <Stack gap="$1">
                <SizableText size="$bodyMdMedium" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.dapp_connect_derive_context_hash_context__title,
                  })}
                </SizableText>
                <TextArea
                  editable={false}
                  numberOfLines={8}
                  value={payload?.context ?? ''}
                />
              </Stack>

              <SizableText size="$bodySm" color="$textCaution">
                {intl.formatMessage({
                  id: ETranslations.dapp_connect_derive_context_hash_warning__desc,
                })}
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
