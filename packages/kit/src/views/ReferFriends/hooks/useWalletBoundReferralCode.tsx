import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  Form,
  Input,
  SizableText,
  Toast,
  XStack,
  YStack,
  useForm,
  useInModalDialog,
  useInTabDialog,
} from '@onekeyhq/components';
import { autoFixPersonalSignMessage } from '@onekeyhq/core/src/chains/evm/sdkEvm/signMessage';
import { EMnemonicType } from '@onekeyhq/core/src/secret';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  FIRST_BTC_TAPROOT_ADDRESS_PATH,
  FIRST_EVM_ADDRESS_PATH,
} from '@onekeyhq/shared/src/engine/engineConsts';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  EMessageTypesBtc,
  EMessageTypesEth,
} from '@onekeyhq/shared/types/message';

import { WalletAvatar } from '../../../components/WalletAvatar/WalletAvatar';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useSignatureConfirm } from '../../../hooks/useSignatureConfirm';

function useGetReferralCodeWalletInfo() {
  return useCallback(async (queryWalletId: string | undefined) => {
    if (!queryWalletId) {
      return null;
    }

    const walletId = queryWalletId;
    let wallet: IDBWallet | undefined;

    if (
      !accountUtils.isHdWallet({ walletId }) &&
      !accountUtils.isHwWallet({ walletId })
    ) {
      return null;
    }

    try {
      wallet = await backgroundApiProxy.serviceAccount.getWallet({
        walletId,
      });
      if (accountUtils.isHwHiddenWallet({ wallet })) {
        return null;
      }
    } catch {
      return null;
    }

    const isBtcOnlyWallet =
      await backgroundApiProxy.serviceHardware.isBtcOnlyWallet({ walletId });

    if (isBtcOnlyWallet) {
      const firstBtcTaprootAccountId = `${walletId}--${FIRST_BTC_TAPROOT_ADDRESS_PATH}`;
      try {
        const networkId = getNetworkIdsMap().btc;
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId: firstBtcTaprootAccountId,
          networkId,
        });
        if (!account) {
          return null;
        }
        return {
          wallet,
          walletId,
          networkId,
          accountId: firstBtcTaprootAccountId,
          address: account.address,
          pubkey: account.pub,
          isBtcOnlyWallet,
        };
      } catch {
        return null;
      }
    }

    // get first evm account, if btc only firmware, get first btc taproot account
    const firstEvmAccountId = `${walletId}--${FIRST_EVM_ADDRESS_PATH}`;
    try {
      const networkId = getNetworkIdsMap().eth;
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: firstEvmAccountId,
        networkId,
      });
      if (!account) {
        return null;
      }
      return {
        wallet,
        walletId,
        networkId,
        accountId: firstEvmAccountId,
        address: account.address,
        pubkey: account.pub,
        isBtcOnlyWallet,
      };
    } catch {
      return null;
    }
  }, []);
}

function InviteCode({
  entry,
  wallet,
  onSuccess,
}: {
  entry?: 'tab' | 'modal';
  wallet?: IDBWallet;
  onSuccess?: () => void;
}) {
  const intl = useIntl();
  const form = useForm({
    defaultValues: {
      referralCode: '',
    },
  });
  const getReferralCodeWalletInfo = useGetReferralCodeWalletInfo();
  const { result: walletInfo } = usePromiseResult(async () => {
    const r = await getReferralCodeWalletInfo(wallet?.id);
    if (!r) {
      return null;
    }
    return r;
  }, [wallet?.id, getReferralCodeWalletInfo]);

  const { navigationToMessageConfirmAsync } = useSignatureConfirm({
    accountId: walletInfo?.accountId ?? '',
    networkId: walletInfo?.networkId ?? '',
  });

  const handleConfirm = useCallback(
    async ({ preventClose }: { preventClose?: () => void }) => {
      try {
        const isValidForm = await form.trigger();
        if (!isValidForm) {
          preventClose?.();
          return;
        }

        if (!walletInfo) {
          throw new OneKeyLocalError('Invalid Wallet');
        }
        const { referralCode } = form.getValues();
        let unsignedMessage: string | undefined;
        try {
          unsignedMessage =
            await backgroundApiProxy.serviceReferralCode.getBoundReferralCodeUnsignedMessage(
              {
                address: walletInfo.address,
                networkId: walletInfo.networkId,
                inviteCode: referralCode,
              },
            );
          console.log('===>>> unsignedMessage: ', unsignedMessage);
        } catch (e) {
          if (
            (e as OneKeyError).className === 'OneKeyServerApiError' &&
            (e as OneKeyError).message
          ) {
            form.setError('referralCode', {
              message: (e as OneKeyError).message,
            });
          }
          throw e;
        }
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
        preventClose?.();
      }
    },
    [onSuccess, form, walletInfo, intl, navigationToMessageConfirmAsync],
  );

  return (
    <YStack mt="$-3">
      <XStack ai="center" gap="$2" pb="$5">
        <SizableText size="$bodyLg">
          {intl.formatMessage({
            id: ETranslations.referral_wallet_code_wallet,
          })}
        </SizableText>
        <XStack
          gap="$2"
          ai="center"
          py="$1"
          pl="$2"
          pr="$3"
          bg="$bgSubdued"
          borderRadius="$2"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
        >
          <WalletAvatar wallet={walletInfo?.wallet} size="$6" />
          <SizableText size="$bodyLg">{walletInfo?.wallet?.name}</SizableText>
        </XStack>
      </XStack>
      <Form form={form}>
        <Form.Field
          name="referralCode"
          rules={{
            required: true,
            pattern: {
              value: /^[a-zA-Z0-9]{1,30}$/,
              message: intl.formatMessage({
                id: ETranslations.referral_invalid_code,
              }),
            },
          }}
        >
          <Input
            placeholder={intl.formatMessage({
              id: ETranslations.referral_wallet_code_placeholder,
            })}
            maxLength={30}
          />
        </Form.Field>
      </Form>
      <SizableText mt="$3" size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.referral_wallet_code_desc,
        })}
      </SizableText>
      <Dialog.Footer
        showCancelButton
        onConfirm={handleConfirm}
        onConfirmText={intl.formatMessage({ id: ETranslations.global_confirm })}
        onCancelText={intl.formatMessage({
          id:
            entry === 'tab'
              ? ETranslations.global_skip
              : ETranslations.global_cancel,
        })}
      />
    </YStack>
  );
}

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

  const inModalDialog = useInModalDialog();
  const inTabDialog = useInTabDialog();
  const dialog = entry === 'modal' ? inModalDialog : inTabDialog;
  const bindWalletInviteCode = useCallback(
    ({ wallet, onSuccess }: { wallet?: IDBWallet; onSuccess?: () => void }) => {
      dialog.show({
        showExitButton: true,
        icon: 'GiftOutline',
        tone: 'success',
        title: intl.formatMessage({
          id: ETranslations.referral_wallet_code_title,
        }),
        renderContent: (
          <InviteCode wallet={wallet} onSuccess={onSuccess} entry={entry} />
        ),
      });
    },
    [dialog, intl, entry],
  );

  return {
    getReferralCodeBondStatus,
    shouldBondReferralCode,
    bindWalletInviteCode,
  };
}
