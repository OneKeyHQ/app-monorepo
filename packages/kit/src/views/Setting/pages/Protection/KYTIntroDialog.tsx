import { memo, useCallback, useEffect, useRef } from 'react';

import { Button, Dialog, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuthMethods } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { settingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';

function KYTIntroDialogContent({
  onEnable,
  onLearnMore,
}: {
  onEnable: () => void;
  onLearnMore: () => void;
}) {
  return (
    <YStack>
      <SizableText size="$bodyLg" color="$textSubdued">
        When enabled, OneKey will automatically check inbound transfers on
        supported networks for risky fund sources — such as sanctioned
        addresses, mixers, or stolen assets — and notify you when high-risk
        funds arrive.
      </SizableText>
      <YStack gap="$3" mt="$5">
        <Button
          testID="kyt-intro-enable"
          variant="primary"
          size="large"
          onPress={onEnable}
        >
          Enable
        </Button>
        <Button
          testID="kyt-intro-learn-more"
          variant="tertiary"
          size="large"
          onPress={onLearnMore}
        >
          Learn more
        </Button>
      </YStack>
    </YStack>
  );
}

function useKYTIntroDialog() {
  const { isPrimeSubscriptionActive } = useOneKeyAuthMethods();
  const shownRef = useRef(false);

  const showDialog = useCallback(() => {
    const dialogInstance = Dialog.show({
      icon: 'ShieldCheckDoneOutline',
      tone: 'success',
      title: 'Receive Risk Monitoring',
      showFooter: false,
      renderContent: (
        <KYTIntroDialogContent
          onEnable={() => {
            void settingsPersistAtom.set((v) => ({
              ...v,
              receiveRiskMonitoring: true,
            }));
            void dialogInstance.close();
          }}
          onLearnMore={() => {
            // TODO: open learn more link once content is ready
          }}
        />
      ),
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
