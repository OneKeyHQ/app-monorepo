import { memo, useCallback, useEffect, useRef } from 'react';

import {
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuthMethods } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

function KYTIntroDialogContent() {
  return (
    <YStack>
      <SizableText size="$bodyLg">
        Check supported incoming token transfers for fund-source risk after they
        are confirmed.
      </SizableText>
      <SizableText size="$bodyLg" mt="$3">
        High and severe risks will trigger a notification. You can turn this off
        anytime in Settings.
      </SizableText>
      <XStack
        mt="$3"
        ai="center"
        gap="$1"
        onPress={() => {
          // TODO: open learn more link once content is ready
        }}
        cursor="pointer"
      >
        <SizableText size="$bodyMdMedium" color="$textSuccess">
          Learn more
        </SizableText>
        <Icon name="ArrowTopRightOutline" size="$4.5" color="$iconSuccess" />
      </XStack>
    </YStack>
  );
}

function useKYTIntroDialog() {
  const { isPrimeSubscriptionActive } = useOneKeyAuthMethods();
  const [{ onekeyUserId }] = usePrimePersistAtom();
  // Track the last Prime user we evaluated so switching accounts re-checks the
  // per-user "shown" flag instead of being suppressed by a single mount guard.
  const processedUserIdRef = useRef<string | undefined>(undefined);

  const showDialog = useCallback(() => {
    Dialog.show({
      icon: 'ShieldCheckDoneOutline',
      title: 'Receive risk monitoring',
      showFooter: true,
      onConfirmText: 'Enable monitoring',
      onCancelText: 'Not now',
      renderContent: <KYTIntroDialogContent />,
      onConfirm: async (dialogInstance) => {
        // Enabling here records server-side authorization; only close on success.
        await backgroundApiProxy.serviceSetting.apiSetKytEnabled({
          enabled: true,
        });
        await dialogInstance.close();
      },
    });
  }, []);

  useEffect(() => {
    if (!isPrimeSubscriptionActive || !onekeyUserId) {
      return;
    }
    if (processedUserIdRef.current === onekeyUserId) {
      return;
    }
    processedUserIdRef.current = onekeyUserId;

    void (async () => {
      const isShown = await backgroundApiProxy.serviceSetting.isKytIntroShown({
        onekeyUserId,
      });
      if (isShown) {
        return;
      }
      // Added gate: only prompt when the server reports KYT is not yet enabled,
      // so users who already turned it on never see the intro again.
      const kytEnabled = await backgroundApiProxy.serviceSetting.getKytEnabled({
        onekeyUserId,
      });
      if (kytEnabled) {
        return;
      }
      await backgroundApiProxy.serviceSetting.setKytIntroShown({
        onekeyUserId,
      });
      showDialog();
    })();
  }, [isPrimeSubscriptionActive, onekeyUserId, showDialog]);
}

function BasicKYTIntroOnMount() {
  useKYTIntroDialog();
  return null;
}

export const KYTIntroOnMount = memo(BasicKYTIntroOnMount);
