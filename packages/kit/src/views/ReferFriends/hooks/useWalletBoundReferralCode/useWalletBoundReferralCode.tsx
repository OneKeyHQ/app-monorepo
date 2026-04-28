import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  EInPageDialogType,
  Toast,
  useInPageDialog,
} from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { INavigationToMessageConfirmParams } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { autoFixPersonalSignMessage } from '@onekeyhq/shared/src/utils/messageUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EMnemonicType } from '@onekeyhq/shared/src/utils/secret';
import {
  EMessageTypesBtc,
  EMessageTypesEth,
} from '@onekeyhq/shared/types/message';

import { InviteCodeDialog } from './InviteCodeDialog';
import { resolveWalletBindStatusAfterCheck } from './referralBindStatusUtils';
import { useGetReferralCodeWalletInfo } from './useGetReferralCodeWalletInfo';

import type { IReferralCodeWalletInfo } from './types';

export function useWalletBoundReferralCode({
  entry,
  mnemonicType,
}: {
  entry?: 'tab' | 'modal';
  mnemonicType?: EMnemonicType;
} = {}) {
  const intl = useIntl();
  const [shouldBondReferralCode, setShouldBondReferralCode] = useState<
    boolean | undefined
  >(undefined);
  const getReferralCodeWalletInfo = useGetReferralCodeWalletInfo();

  const getReferralCodeBondStatus = useCallback(
    async ({
      walletId,
      skipIfTimeout = false,
    }: {
      walletId: string | undefined;
      skipIfTimeout?: boolean;
    }) => {
      if (mnemonicType === EMnemonicType.TON) {
        return false;
      }

      const walletInfo = await getReferralCodeWalletInfo(walletId);
      if (!walletInfo) {
        return false;
      }
      const { address, networkId } = walletInfo;
      const cachedReferralCodeInfo =
        await backgroundApiProxy.serviceReferralCode.getWalletReferralCode({
          walletId: walletInfo.walletId,
        });

      let serverStatus;
      let isTimeout = false;

      try {
        if (skipIfTimeout) {
          const timeoutMs = 3000;
          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              isTimeout = true;
              reject(new Error('Request timeout'));
            }, timeoutMs);
          });

          try {
            serverStatus = await Promise.race([
              backgroundApiProxy.serviceReferralCode.checkWalletBindStatus({
                address,
                networkId,
              }),
              timeoutPromise,
            ]);
          } finally {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          }
        } else {
          serverStatus =
            await backgroundApiProxy.serviceReferralCode.checkWalletBindStatus({
              address,
              networkId,
            });
        }
      } catch {
        // Fall back to local status when the server check is unavailable.
      }

      const resolvedBindStatus = resolveWalletBindStatusAfterCheck({
        serverStatus,
        cachedReferralCodeInfo,
        isTimeout,
        skipIfTimeout,
      });

      if (resolvedBindStatus.shouldSkip) {
        return false;
      }

      if (resolvedBindStatus.shouldPersist) {
        try {
          await backgroundApiProxy.serviceReferralCode.setWalletReferralCode({
            walletId: walletInfo.walletId,
            referralCodeInfo: {
              walletId: walletInfo.walletId,
              address: walletInfo.address,
              networkId: walletInfo.networkId,
              pubkey: walletInfo.pubkey ?? '',
              isBound: resolvedBindStatus.status.isBound,
              bindable: resolvedBindStatus.status.bindable,
              bindWindowReason: resolvedBindStatus.status.bindWindowReason,
            },
          });
        } catch {
          // Ignore local cache write failures; the server status remains authoritative.
        }
      }

      if (!resolvedBindStatus.shouldShowBindDialog) {
        return false;
      }
      setShouldBondReferralCode(true);
      return true;
    },
    [mnemonicType, getReferralCodeWalletInfo],
  );

  const confirmBindReferralCode = useCallback(
    async ({
      referralCode,
      preventClose,
      walletInfo,
      navigationToMessageConfirmAsync,
      onSuccess,
    }: {
      referralCode: string;
      walletInfo: IReferralCodeWalletInfo | null | undefined;
      navigationToMessageConfirmAsync: (
        params: INavigationToMessageConfirmParams,
      ) => Promise<string>;
      preventClose?: () => void;
      onSuccess?: () => void;
    }) => {
      try {
        if (!walletInfo) {
          throw new OneKeyLocalError('Invalid Wallet');
        }
        let unsignedMessage: string | undefined;

        unsignedMessage =
          await backgroundApiProxy.serviceReferralCode.getBoundReferralCodeUnsignedMessage(
            {
              address: walletInfo.address,
              networkId: walletInfo.networkId,
              inviteCode: referralCode,
            },
          );

        if (walletInfo.networkId === getNetworkIdsMap().eth) {
          unsignedMessage = autoFixPersonalSignMessage({
            message: unsignedMessage,
          });
        }

        const isBtcOnlyWallet =
          walletInfo.isBtcOnlyWallet &&
          networkUtils.isBTCNetwork(walletInfo.networkId);

        const finalUnsignedMessage: IUnsignedMessage = isBtcOnlyWallet
          ? {
              type: EMessageTypesBtc.ECDSA,
              message: unsignedMessage,
              sigOptions: {
                noScriptType: true,
              },
              payload: {
                isFromDApp: false,
              },
            }
          : {
              type: EMessageTypesEth.PERSONAL_SIGN,
              message: unsignedMessage,
              payload: [unsignedMessage, walletInfo.address],
            };

        let signedMessage: string | null;

        signedMessage =
          await backgroundApiProxy.serviceReferralCode.autoSignBoundReferralCodeMessageByHDWallet(
            {
              unsignedMessage: finalUnsignedMessage,
              networkId: walletInfo.networkId,
              accountId: walletInfo.accountId,
            },
          );

        if (!signedMessage) {
          signedMessage = await navigationToMessageConfirmAsync({
            accountId: walletInfo.accountId,
            networkId: walletInfo.networkId,
            unsignedMessage: finalUnsignedMessage,
            walletInternalSign: true,
            sameModal: false,
            skipBackupCheck: true,
          });
        }

        if (!signedMessage) {
          throw new OneKeyLocalError('Failed to sign message');
        }

        const bindResult =
          await backgroundApiProxy.serviceReferralCode.boundReferralCodeWithSignedMessage(
            {
              address: walletInfo.address,
              networkId: walletInfo.networkId,
              pubkey: walletInfo.pubkey || undefined,
              referralCode,
              signature: isBtcOnlyWallet
                ? Buffer.from(signedMessage, 'hex').toString('base64')
                : signedMessage,
            },
          );
        if (bindResult) {
          await backgroundApiProxy.serviceReferralCode.setWalletReferralCode({
            walletId: walletInfo.walletId,
            referralCodeInfo: {
              walletId: walletInfo.walletId,
              address: walletInfo.address,
              networkId: walletInfo.networkId,
              pubkey: walletInfo.pubkey ?? '',
              isBound: true,
            },
          });
          // Clear cached invite code after successful binding
          await backgroundApiProxy.serviceReferralCode.setCachedInviteCode('');
          defaultLogger.referral.page.referralBindingCompleted({
            referralCode,
            address: walletInfo.address,
            networkId: walletInfo.networkId,
          });
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.global_success,
            }),
          });
          onSuccess?.();
        }
      } catch (e) {
        // Keep API validation errors inline in the form instead of showing a toast.
        errorToastUtils.toastIfErrorDisable(e);

        const err = e as OneKeyError<
          unknown,
          {
            message?: string;
            messageId?: string;
          }
        >;
        const isServerApiError =
          err?.className === EOneKeyErrorClassNames.OneKeyServerApiError;
        const isBindWindowExpired =
          err?.data?.messageId === 'exceeded_bind_window' ||
          err?.data?.message === 'exceeded_bind_window' ||
          err?.message === 'exceeded_bind_window';

        // Only suppress toast for server API errors when preventClose is
        // provided — the caller (InviteCodeDialog) handles them inline via
        // form.setError(). Other call sites have no inline display, so they
        // still need the toast.
        if (!(isServerApiError && preventClose) && err?.message) {
          Toast.error({
            title: isBindWindowExpired
              ? intl.formatMessage({
                  id: ETranslations.referral_not_applicable_desc,
                })
              : err.message,
          });
        }
        preventClose?.();
        throw e;
      }
    },
    [intl],
  );

  const dialog = useInPageDialog(
    entry === 'modal'
      ? EInPageDialogType.inModalPage
      : EInPageDialogType.inTabPages,
  );
  const bindWalletInviteCode = useCallback(
    ({
      wallet,
      onSuccess,
      onClose,
      defaultReferralCode,
    }: {
      wallet?: IDBWallet;
      onSuccess?: () => void;
      onClose?: () => void;
      defaultReferralCode?: string;
    }) => {
      dialog.show({
        showExitButton: true,
        onClose,
        title: intl.formatMessage({
          id: ETranslations.referral_apply_referral_code,
        }),
        renderContent: (
          <InviteCodeDialog
            wallet={wallet}
            onSuccess={onSuccess}
            confirmBindReferralCode={confirmBindReferralCode}
            defaultReferralCode={defaultReferralCode}
          />
        ),
      });
    },
    [dialog, intl, confirmBindReferralCode],
  );

  return {
    getReferralCodeBondStatus,
    shouldBondReferralCode,
    bindWalletInviteCode,
    confirmBindReferralCode,
  };
}
