import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Button,
  DialogContainer,
  EInPageDialogType,
  SizableText,
  Spinner,
  Theme,
  XStack,
  YStack,
  useDialogInstance,
  useInPageDialog,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IThirdPartyDeviceRewardClaimSuccess,
  IThirdPartyDeviceRewardVendor,
} from '@onekeyhq/shared/src/hardware/thirdPartyDeviceReward';

function ThirdPartyDeviceRewardDialogContent({
  wallet,
  vendor,
  connectId,
  onDone,
}: {
  wallet: IDBWallet;
  vendor: IThirdPartyDeviceRewardVendor;
  connectId: string;
  onDone: () => void;
}) {
  const dialogInstance = useDialogInstance();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const [claimResult, setClaimResult] =
    useState<IThirdPartyDeviceRewardClaimSuccess>();
  const isPendingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const finish = useCallback(async () => {
    await dialogInstance.close();
    onDone();
  }, [dialogInstance, onDone]);

  const handleVerify = useCallback(async () => {
    if (isPendingRef.current) return;

    isPendingRef.current = true;
    setError(undefined);
    setIsPending(true);
    try {
      const claim =
        await backgroundApiProxy.serviceThirdPartyDeviceReward.verifyAndClaimThirdPartyDeviceReward(
          {
            vendor,
            connectId,
            dbDeviceId: wallet.associatedDevice,
          },
        );
      if (isMountedRef.current) {
        setClaimResult(claim);
      }
    } catch (e) {
      if (isMountedRef.current) {
        setError(
          e instanceof Error
            ? e.message
            : 'Device verification failed. Please try again.',
        );
      }
    } finally {
      isPendingRef.current = false;
      if (isMountedRef.current) {
        setIsPending(false);
      }
    }
  }, [connectId, vendor, wallet.associatedDevice]);

  if (claimResult) {
    return (
      <YStack gap="$4">
        <YStack gap="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            {claimResult.status === 'issued'
              ? 'Reward issued'
              : 'This device already claimed a reward'}
          </SizableText>
          <SizableText selectable>{claimResult.voucher.code}</SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            Voucher status: {claimResult.voucher.status}
          </SizableText>
        </YStack>
        <Button variant="primary" onPress={finish}>
          Done
        </Button>
      </YStack>
    );
  }

  return (
    <YStack gap="$4">
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
  vendor: IThirdPartyDeviceRewardVendor;
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
              description="Confirm this newly added physical device with OneKey to claim your reward."
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
