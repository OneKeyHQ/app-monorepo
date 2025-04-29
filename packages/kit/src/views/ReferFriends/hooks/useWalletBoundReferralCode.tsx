import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  OTPInput,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { FIRST_EVM_ADDRESS_PATH } from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { WalletAvatar } from '../../../components/WalletAvatar/WalletAvatar';

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
  const handleConfirm = useCallback(async () => {
    try {
      await backgroundApiProxy.serviceReferralCode.bindInviteCode(
        verificationCode,
      );
      onSuccess?.();
    } catch {
      onFail?.();
    }
  }, [onFail, onSuccess, verificationCode]);
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
        onCancel={() => {
          console.log('===>>> skip');
        }}
      />
    </YStack>
  );
}

export function useWalletBoundReferralCode() {
  const intl = useIntl();
  const [shouldBondReferralCode, setShouldBondReferralCode] = useState<
    boolean | undefined
  >(undefined);

  const getReferralCodeBondStatus = async (walletId: string | undefined) => {
    if (!walletId) {
      return false;
    }

    if (
      !accountUtils.isHdWallet({ walletId }) &&
      !accountUtils.isHwWallet({ walletId })
    ) {
      return false;
    }

    // get first evm account, if btc only firmware, get first btc taproot account
    const firstEvmAccountId = `${walletId}--${FIRST_EVM_ADDRESS_PATH}`;
    try {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: firstEvmAccountId,
        networkId: getNetworkIdsMap().eth,
      });
      if (!account) {
        return false;
      }
      const address = account.address;
      console.log('===>>> check first evm address: ', address);
      await timerUtils.wait(1000);

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
        onClose: () => {
          console.log('===>>> close');
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
