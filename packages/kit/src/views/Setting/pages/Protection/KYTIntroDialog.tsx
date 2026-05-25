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
import { settingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';

function KYTIntroDialogContent() {
  return (
    <YStack>
      <SizableText size="$bodyLg" color="$textSubdued">
        Check supported incoming token transfers for fund-source risk after they
        are confirmed.
      </SizableText>
      <SizableText size="$bodyLg" color="$textSubdued" mt="$3">
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
        <SizableText size="$bodyLg" color="$textSuccess">
          Learn more
        </SizableText>
        <Icon name="ArrowTopRightOutline" size="$4.5" color="$iconSuccess" />
      </XStack>
    </YStack>
  );
}

function useKYTIntroDialog() {
  const { isPrimeSubscriptionActive } = useOneKeyAuthMethods();
  const shownRef = useRef(false);

  const showDialog = useCallback(() => {
    Dialog.show({
      icon: 'ShieldCheckDoneOutline',
      title: 'Receive risk monitoring',
      showFooter: true,
      onConfirmText: 'Enable monitoring',
      onCancelText: 'Not now',
      renderContent: <KYTIntroDialogContent />,
      onConfirm: async (dialogInstance) => {
        void settingsPersistAtom.set((v) => ({
          ...v,
          receiveRiskMonitoring: true,
        }));
        await dialogInstance.close();
      },
    });
  }, []);

  useEffect(() => {
    if (shownRef.current) {
      return;
    }
    if (!isPrimeSubscriptionActive) {
      return;
    }
    shownRef.current = true;

    void (async () => {
      const isShown = await backgroundApiProxy.serviceSetting.isKytIntroShown();
      if (isShown) {
        return;
      }
      await backgroundApiProxy.serviceSetting.setKytIntroShown();
      showDialog();
    })();
  }, [isPrimeSubscriptionActive, showDialog]);
}

function BasicKYTIntroOnMount() {
  useKYTIntroDialog();
  return null;
}

export const KYTIntroOnMount = memo(BasicKYTIntroOnMount);
