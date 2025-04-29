import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  OTPInput,
  SizableText,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { FIRST_EVM_ADDRESS_PATH } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyPlainTextError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { WalletAvatar } from '../../../components/WalletAvatar/WalletAvatar';

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

const NUMBER_OF_DIGITS = 6;
function InviteCode({
  wallet,
  onSuccess,
  onFail,
}: {
  wallet?: IDBWallet;
  onSuccess?: () => void;
  onFail?: () => void;
}) {
  const intl = useIntl();
  const [verificationCode, setVerificationCode] = useState('');
  const getReferralCodeWalletInfo = useGetReferralCodeWalletInfo();

  const handleConfirm = useCallback(
    async ({ preventClose }: { preventClose?: () => void }) => {
      try {
        const walletInfo = await getReferralCodeWalletInfo(wallet?.id);
        if (!walletInfo) {
          throw new OneKeyPlainTextError('Invalid Wallet');
        }
        const unsignedMessage =
          await backgroundApiProxy.serviceReferralCode.getBoundReferralCodeUnsignedMessage(
            {
              address: walletInfo.address,
              networkId: walletInfo.networkId,
              inviteCode: verificationCode,
            },
          );
        console.log('===>>> unsignedMessage: ', unsignedMessage);

        // const signedMessage =
        //   (await backgroundApiProxy.serviceDApp.openSignMessageModal({
        //     accountId: walletInfo.accountId,
        //     networkId: walletInfo.networkId,
        //     request: {
        //       origin: 'https://app.onekey.so/',
        //       scope: 'ethereum',
        //     },
        //     unsignedMessage: {
        //       type: EMessageTypesEth.PERSONAL_SIGN,
        //       message: unsignedMessage,
        //       payload: [unsignedMessage, walletInfo.address],
        //     },
        //     walletInternalSign: true,
        //   })) as string;

        // console.log('===>>> signedMessage: ', signedMessage);

        onSuccess?.();
      } catch (e) {
        console.log('eeeedialog EEEE=> : ', e);
        preventClose?.();
        // onFail?.();
      }
    },
    [
      // onFail,
      onSuccess,
      verificationCode,
      wallet?.id,
      getReferralCodeWalletInfo,
    ],
  );

  const handleSkip = useCallback(async () => {
    const walletInfo = await getReferralCodeWalletInfo(wallet?.id);
    if (!walletInfo) {
      return;
    }

    await backgroundApiProxy.serviceReferralCode.setWalletReferralCode({
      walletId: walletInfo.walletId,
      referralCodeInfo: {
        walletId: walletInfo.walletId,
        address: walletInfo.address,
        networkId: walletInfo.networkId,
        pubkey: walletInfo.pubkey ?? '',
        referralCode: null,
      },
    });
  }, [wallet?.id, getReferralCodeWalletInfo]);

  return (
    <YStack mt="$-3">
      <XStack ai="center" gap="$2" pb="$5">
        <SizableText size="$bodyLg">Bound wallet:</SizableText>
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
      <OTPInput
        type="alphanumeric"
        autoFocus
        status="normal"
        numberOfDigits={NUMBER_OF_DIGITS}
        value={verificationCode}
        onTextChange={(value) => {
          setVerificationCode(value);
        }}
      />
      <SizableText mt="$3" size="$bodyMd" color="$textSubdued">
        Once bounded, all addresses derived from this wallet will be associated
        with this referral code and cannot be changed.
      </SizableText>
      <Dialog.Footer
        showCancelButton
        confirmButtonProps={{
          disabled: verificationCode.length !== NUMBER_OF_DIGITS,
        }}
        onConfirm={handleConfirm}
        onConfirmText={intl.formatMessage({ id: ETranslations.global_confirm })}
        onCancelText="Skip"
        onCancel={handleSkip}
      />
    </YStack>
  );
}

export function useWalletBoundReferralCode() {
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

  const bindWalletInviteCode = useCallback(
    ({
      wallet,
      onSuccess,
      onFail,
    }: {
      wallet?: IDBWallet;
      onSuccess?: () => void;
      onFail?: () => void;
    }) => {
      Dialog.show({
        showExitButton: true,
        icon: 'GiftOutline',
        tone: 'success',
        title: 'Do you have a referral code?',
        renderContent: (
          <InviteCode wallet={wallet} onSuccess={onSuccess} onFail={onFail} />
        ),
        onClose: (extra) => {
          console.log('===>>> close: ===>: ', extra);
        },
      });
    },
    [],
  );

  return {
    getReferralCodeBondStatus,
    shouldBondReferralCode,
    bindWalletInviteCode,
  };
}
