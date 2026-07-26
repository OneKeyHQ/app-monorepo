import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Button,
  DialogContainer,
  EInPageDialogType,
  Input,
  SizableText,
  Spinner,
  Theme,
  XStack,
  YStack,
  useDialogInstance,
  useInPageDialog,
} from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IThirdPartyDeviceRewardEvidence,
  IThirdPartyHardwareRewardVendor,
} from '@onekeyhq/shared/src/referralCode/type';
import { autoFixPersonalSignMessage } from '@onekeyhq/shared/src/utils/messageUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import {
  EMessageTypesBtc,
  EMessageTypesEth,
} from '@onekeyhq/shared/types/message';

export const THIRD_PARTY_DEVICE_REWARD_CAMPAIGN_ID =
  'third-party-hardware-2026';

type IAuthenticityResult = {
  vendor: 'trezor' | 'ledger';
  verified: boolean;
  trezorProof?: {
    challenge: string;
    deviceModel: string;
    proof: Extract<
      IThirdPartyDeviceRewardEvidence,
      { vendor: 'trezor' }
    >['proof'];
  };
};

function ThirdPartyDeviceRewardDialogContent({
  wallet,
  vendor,
  connectId,
  onDone,
}: {
  wallet: IDBWallet;
  vendor: IThirdPartyHardwareRewardVendor;
  connectId: string;
  onDone: () => void;
}) {
  const dialogInstance = useDialogInstance();
  const [inviteCode, setInviteCode] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const { result: walletInfo } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceReferralCode.getThirdPartyDeviceRewardWalletInfo(
        { walletId: wallet.id },
      ),
    [wallet.id],
  );
  const { navigationToMessageConfirmAsync } = useSignatureConfirm({
    accountId: walletInfo?.accountId ?? '',
    networkId: walletInfo?.networkId ?? '',
  });

  const finish = useCallback(async () => {
    onDone();
    await dialogInstance.close();
  }, [dialogInstance, onDone]);

  const handleVerify = useCallback(async () => {
    if (isPending) return;
    if (!walletInfo) {
      setError('The reward address is not ready yet. Please try again.');
      return;
    }
    if (!connectId) {
      setError('Reconnect the hardware wallet to verify this device.');
      return;
    }

    setError(undefined);
    setIsPending(true);
    try {
      const challenge =
        await backgroundApiProxy.serviceReferralCode.createThirdPartyDeviceRewardChallenge(
          {
            walletId: wallet.id,
            vendor,
            campaignId: THIRD_PARTY_DEVICE_REWARD_CAMPAIGN_ID,
            // A cancelled signature or expired challenge must be retryable.
            // The backend independently checks first-add eligibility; it never
            // treats this client-generated id as proof of eligibility.
            walletAddAttemptId: generateUUID(),
          },
        );

      const authenticity =
        await backgroundApiProxy.serviceThirdPartyHardware.thirdPartyHardwareVerifyDeviceAuthenticity(
          {
            vendor:
              vendor === 'ledger'
                ? EHardwareVendor.ledger
                : EHardwareVendor.trezor,
            connectId,
            challenge: vendor === 'trezor' ? challenge.challengeHex : undefined,
            ledgerGenuineCheckWebSocketUrl:
              vendor === 'ledger'
                ? challenge.ledgerRelay?.webSocketUrl
                : undefined,
          },
        );
      if (!authenticity.success) {
        throw new OneKeyLocalError(
          'The device authenticity check did not complete.',
        );
      }
      const authenticityPayload = authenticity.payload as IAuthenticityResult;
      if (!authenticityPayload.verified) {
        throw new OneKeyLocalError(
          'The connected device could not be verified as genuine.',
        );
      }

      const rawMessage = stableStringify(challenge.addressMessage);
      const isBtc =
        walletInfo.isBtcOnlyWallet &&
        networkUtils.isBTCNetwork(walletInfo.networkId);
      const message = isBtc
        ? rawMessage
        : autoFixPersonalSignMessage({ message: rawMessage });
      const unsignedMessage: IUnsignedMessage = isBtc
        ? {
            type: EMessageTypesBtc.ECDSA,
            message,
            sigOptions: { noScriptType: true },
            payload: { isFromDApp: false },
          }
        : {
            type: EMessageTypesEth.PERSONAL_SIGN,
            message,
            payload: [message, walletInfo.address],
          };
      const signature = await navigationToMessageConfirmAsync({
        accountId: walletInfo.accountId,
        networkId: walletInfo.networkId,
        unsignedMessage,
        walletInternalSign: true,
        sameModal: false,
        skipBackupCheck: true,
      });
      if (!signature) {
        throw new OneKeyLocalError('Address signature was cancelled.');
      }

      let evidence: IThirdPartyDeviceRewardEvidence;
      if (vendor === 'trezor') {
        const trezorProof = authenticityPayload.trezorProof;
        if (!trezorProof || trezorProof.challenge !== challenge.challengeHex) {
          throw new OneKeyLocalError(
            'The Trezor proof did not match the server challenge.',
          );
        }
        evidence = {
          vendor: 'trezor',
          scheme: 'trezor-authenticate-device-v1',
          deviceModelHint: trezorProof.deviceModel,
          proof: trezorProof.proof,
        };
      } else {
        const attestationSessionId =
          challenge.ledgerRelay?.attestationSessionId;
        if (!attestationSessionId) {
          throw new OneKeyLocalError(
            'The Ledger attestation relay is unavailable.',
          );
        }
        evidence = {
          vendor: 'ledger',
          scheme: 'ledger-genuine-relay-v1',
          attestationSessionId,
        };
      }

      const claim =
        await backgroundApiProxy.serviceReferralCode.claimThirdPartyDeviceReward(
          {
            challengeId: challenge.challengeId,
            inviteCode: inviteCode.trim() || undefined,
            addressSignature: {
              scheme: isBtc ? 'btc-ecdsa' : 'evm-personal-sign',
              address: walletInfo.address,
              signature,
              pubkey: walletInfo.pubkey,
            },
            evidence,
          },
        );
      if (claim.status !== 'issued' && claim.status !== 'already_claimed') {
        throw new OneKeyLocalError(
          `Device reward was not issued: ${claim.status}`,
        );
      }
      if (isMountedRef.current) {
        await finish();
      }
    } catch (e) {
      if (isMountedRef.current) {
        setError(
          e instanceof Error
            ? e.message
            : 'Device verification failed. Please try again.',
        );
        setIsPending(false);
      }
    }
  }, [
    connectId,
    finish,
    inviteCode,
    isPending,
    navigationToMessageConfirmAsync,
    vendor,
    wallet.id,
    walletInfo,
  ]);

  return (
    <YStack gap="$4">
      <Input
        testID="third-party-device-reward-invite-code"
        value={inviteCode}
        onChangeText={setInviteCode}
        placeholder="Invite code (optional)"
        maxLength={30}
        autoCapitalize="none"
        disabled={isPending}
      />
      {error ? (
        <SizableText size="$bodySm" color="$textCritical">
          {error}
        </SizableText>
      ) : null}
      <XStack gap="$2.5">
        <Button
          testID="third-party-device-reward-skip"
          flex={1}
          disabled={isPending}
          onPress={finish}
        >
          Not now
        </Button>
        <Button
          testID="third-party-device-reward-verify"
          flex={1}
          variant="primary"
          disabled={isPending}
          onPress={handleVerify}
          icon={isPending ? <Spinner size="small" /> : undefined}
        >
          {isPending ? 'Verifying' : 'Verify device'}
        </Button>
      </XStack>
    </YStack>
  );
}

export type IShowThirdPartyDeviceRewardDialog = (params: {
  wallet: IDBWallet;
  vendor: IThirdPartyHardwareRewardVendor;
  connectId: string;
  onDone: () => void;
}) => void;

// TODO(i18n): replace hardcoded product copy with ETranslations entries after
// copy review. Locale enum/generated files must not be edited by hand.
export function useShowThirdPartyDeviceRewardDialog(): IShowThirdPartyDeviceRewardDialog {
  const dialog = useInPageDialog(EInPageDialogType.inModalPage);
  return useCallback(
    ({ wallet, vendor, connectId, onDone }) => {
      let onDoneCalled = false;
      const callOnDoneOnce = () => {
        if (onDoneCalled) return;
        onDoneCalled = true;
        onDone();
      };
      dialog.show({
        dialogContainer: ({ ref }) => (
          <Theme name="dark">
            <DialogContainer
              ref={ref}
              showExitButton={false}
              showFooter={false}
              title="Verify your device and get a reward"
              description="Confirm this newly added physical device with OneKey. A device ID alone is never enough to claim the reward."
              renderContent={
                <ThirdPartyDeviceRewardDialogContent
                  wallet={wallet}
                  vendor={vendor}
                  connectId={connectId}
                  onDone={callOnDoneOnce}
                />
              }
              onClose={async () => undefined}
            />
          </Theme>
        ),
        onClose: callOnDoneOnce,
      });
    },
    [dialog],
  );
}
