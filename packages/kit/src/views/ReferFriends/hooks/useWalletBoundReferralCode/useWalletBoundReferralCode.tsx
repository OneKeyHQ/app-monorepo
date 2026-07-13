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
import type { ICheckWalletBindStatusResponse } from '@onekeyhq/shared/src/referralCode/type';
import { autoFixPersonalSignMessage } from '@onekeyhq/shared/src/utils/messageUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EMnemonicType } from '@onekeyhq/shared/src/utils/secret';
import {
  EMessageTypesBtc,
  EMessageTypesEth,
} from '@onekeyhq/shared/types/message';

import { InviteCodeDialog } from './InviteCodeDialog';
import {
  type IReferralBindDisplayStatus,
  getReferralBindDisplayStatus,
} from './referralBindStatusUtils';
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

  const getReferralCodeBindDisplayStatus = useCallback(
    async ({
      walletId,
      skipIfTimeout = false,
    }: {
      walletId: string | undefined;
      skipIfTimeout?: boolean;
    }): Promise<IReferralBindDisplayStatus> => {
      if (mnemonicType === EMnemonicType.TON) {
        return 'unknown';
      }

      const walletInfo = await getReferralCodeWalletInfo(walletId);
      if (!walletInfo) {
        return 'unknown';
      }
      const { address, networkId } = walletInfo;

      let serverStatus: ICheckWalletBindStatusResponse | undefined;
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
        // Keep the UI status unknown when the server check is unavailable.
      }

      if ((isTimeout && skipIfTimeout) || !serverStatus) {
        return 'unknown';
      }

      const isBound =
        serverStatus.data || serverStatus.reason === 'already_bound';
      const isExpired = serverStatus.reason === 'exceeded_bind_window';
      const bindStatus = {
        isBound,
        bindable: !isBound && !isExpired,
        bindWindowReason: isBound ? undefined : serverStatus.reason,
      };

      return getReferralBindDisplayStatus(bindStatus);
    },
    [mnemonicType, getReferralCodeWalletInfo],
  );

  const getReferralCodeBondStatus = useCallback(
    async (params: {
      walletId: string | undefined;
      skipIfTimeout?: boolean;
    }) => {
      const displayStatus = await getReferralCodeBindDisplayStatus(params);
      if (displayStatus !== 'bind') {
        return false;
      }
      setShouldBondReferralCode(true);
      return true;
    },
    [getReferralCodeBindDisplayStatus],
  );

  const confirmBindReferralCode = useCallback(
    async ({
      referralCode,
      preventClose,
      walletInfo,
      navigationToMessageConfirmAsync,
      onSuccess,
      suppressSuccessToast,
      suppressErrorToast,
      source,
    }: {
      referralCode: string;
      walletInfo: IReferralCodeWalletInfo | null | undefined;
      navigationToMessageConfirmAsync: (
        params: INavigationToMessageConfirmParams,
      ) => Promise<string>;
      preventClose?: () => void;
      onSuccess?: () => void;
      /**
       * Where the bind was triggered from. Threaded into the
       * referralBindingCompleted analytics event so the caller doesn't have
       * to re-log it (which would cause a double-fire).
       */
      source?: 'onboarding_dialog' | 'home_block' | 'settings';
      /**
       * If true, do not show the default success Toast on bind success.
       * Use this when the caller renders its own success feedback (e.g. an
       * animated confirm button) and a Toast would be redundant.
       */
      suppressSuccessToast?: boolean;
      /**
       * If true, never show the default error Toast on bind failure. Use
       * this when the caller surfaces errors inline (e.g. via form.setError)
       * for all error types — not just server API errors.
       */
      suppressErrorToast?: boolean;
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
              bindable: false,
              bindWindowReason: undefined,
            },
          });
          await backgroundApiProxy.serviceReferralCode.setCachedInviteCode('');
          defaultLogger.referral.page.referralBindingCompleted({
            referralCode,
            address: walletInfo.address,
            networkId: walletInfo.networkId,
            source,
          });
          if (!suppressSuccessToast) {
            Toast.success({
              title: intl.formatMessage({
                id: ETranslations.global_success,
              }),
            });
          }
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

        // Suppress toast when:
        //   - caller opts out unconditionally (suppressErrorToast), or
        //   - caller provides preventClose for inline server-error handling
        //     (Settings InviteCodeDialog pattern).
        // Otherwise the call site has no inline display and still needs it.
        if (
          !suppressErrorToast &&
          !(isServerApiError && preventClose) &&
          err?.message
        ) {
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
    getReferralCodeBindDisplayStatus,
    shouldBondReferralCode,
    bindWalletInviteCode,
    confirmBindReferralCode,
  };
}
