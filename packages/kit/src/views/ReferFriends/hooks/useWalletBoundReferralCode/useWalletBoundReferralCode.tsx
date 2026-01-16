import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  EInPageDialogType,
  Toast,
  useInPageDialog,
} from '@onekeyhq/components';
import { autoFixPersonalSignMessage } from '@onekeyhq/core/src/chains/evm/sdkEvm/signMessage';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { INavigationToMessageConfirmParams } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EMnemonicType } from '@onekeyhq/shared/src/utils/secret';
import {
  EMessageTypesBtc,
  EMessageTypesEth,
} from '@onekeyhq/shared/types/message';

import { InviteCodeDialog } from './InviteCodeDialog';
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

      let alreadyBound = false;
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
            // Race between the API call and timeout
            alreadyBound = await Promise.race([
              backgroundApiProxy.serviceReferralCode.checkWalletIsBoundReferralCode(
                {
                  address,
                  networkId,
                },
              ),
              timeoutPromise,
            ]);
          } finally {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          }
        } else {
          // No timeout, just make the request
          alreadyBound =
            await backgroundApiProxy.serviceReferralCode.checkWalletIsBoundReferralCode(
              {
                address,
                networkId,
              },
            );
        }
      } catch (error) {
        console.log(
          '===>>> getReferralCodeBondStatus error, treating as not bound:',
          error,
        );
        alreadyBound = false;
      }

      // Always execute setWalletReferralCode regardless of timeout
      try {
        await backgroundApiProxy.serviceReferralCode.setWalletReferralCode({
          walletId: walletInfo.walletId,
          referralCodeInfo: {
            walletId: walletInfo.walletId,
            address: walletInfo.address,
            networkId: walletInfo.networkId,
            pubkey: walletInfo.pubkey ?? '',
            isBound: alreadyBound,
          },
        });
      } catch (error) {
        console.log('===>>> setWalletReferralCode error:', error);
      }

      if (isTimeout && skipIfTimeout) {
        return false;
      }

      if (alreadyBound) {
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
        console.log('===>>> unsignedMessage: ', unsignedMessage);

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
        console.log('===>>> signedMessage: ', signedMessage);
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
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.global_success,
            }),
          });
          onSuccess?.();
        }
      } catch (e) {
        // Disable auto toast for this error to show custom toast without requestId
        errorToastUtils.toastIfErrorDisable(e);

        // Show custom error toast without requestId
        const err = e as OneKeyError;
        if (err?.message) {
          Toast.error({
            title: err.message,
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
      defaultReferralCode,
    }: {
      wallet?: IDBWallet;
      onSuccess?: () => void;
      defaultReferralCode?: string;
    }) => {
      dialog.show({
        showExitButton: true,
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
