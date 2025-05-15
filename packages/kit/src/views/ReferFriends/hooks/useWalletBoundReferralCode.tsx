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
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { FIRST_EVM_ADDRESS_PATH } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyPlainTextError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { WalletAvatar } from '../../../components/WalletAvatar/WalletAvatar';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useSignatureConfirm } from '../../../hooks/useSignatureConfirm';

function useGetReferralCodeWalletInfo() {
  return useCallback(async (walletId: string | undefined) => {
    if (!walletId) {
      return null;
    }

    if (
      !accountUtils.isHdWallet({ walletId }) &&
      !accountUtils.isHwWallet({ walletId })
    ) {
      return null;
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
        walletId,
        networkId,
        accountId: firstEvmAccountId,
        address: account.address,
        pubkey: account.pub,
      };
    } catch {
      return null;
    }
  }, []);
}

function InviteCode({
  wallet,
  onSuccess,
}: {
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
          throw new OneKeyPlainTextError('Invalid Wallet');
        }
        const { referralCode } = form.getValues();
        let unsignedMessage =
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

        const signedMessage = await navigationToMessageConfirmAsync({
          accountId: walletInfo.accountId,
          networkId: walletInfo.networkId,
          unsignedMessage: {
            type: EMessageTypesEth.PERSONAL_SIGN,
            message: unsignedMessage,
            payload: [unsignedMessage, walletInfo.address],
          },
          walletInternalSign: true,
          sameModal: false,
          skipBackupCheck: true,
        });

        const bindResult =
          await backgroundApiProxy.serviceReferralCode.boundReferralCodeWithSignedMessage(
            {
              address: walletInfo.address,
              networkId: walletInfo.networkId,
              pubkey: walletInfo.pubkey || undefined,
              referralCode,
              signature: signedMessage,
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
          <WalletAvatar wallet={wallet} size="$6" />
          <SizableText size="$bodyLg">{wallet?.name}</SizableText>
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
          id: ETranslations.global_skip,
        })}
      />
    </YStack>
  );
}

export function useWalletBoundReferralCode({
  entry,
}: {
  entry?: 'tab' | 'modal';
} = {}) {
  const intl = useIntl();
  const [shouldBondReferralCode, setShouldBondReferralCode] = useState<
    boolean | undefined
  >(undefined);
  const getReferralCodeWalletInfo = useGetReferralCodeWalletInfo();

  const getReferralCodeBondStatus = async (walletId: string | undefined) => {
    const walletInfo = await getReferralCodeWalletInfo(walletId);
    if (!walletInfo) {
      return false;
    }
    const { address, networkId } = walletInfo;
    try {
      const alreadyBound =
        await backgroundApiProxy.serviceReferralCode.checkWalletIsBoundReferralCode(
          {
            address,
            networkId,
          },
        );
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
      if (alreadyBound) {
        return false;
      }
      console.log('===>>> check first evm address: ', address);
      setShouldBondReferralCode(true);
      return true;
    } catch {
      return false;
    }
  };

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
        renderContent: <InviteCode wallet={wallet} onSuccess={onSuccess} />,
      });
    },
    [dialog, intl],
  );

  return {
    getReferralCodeBondStatus,
    shouldBondReferralCode,
    bindWalletInviteCode,
  };
}
