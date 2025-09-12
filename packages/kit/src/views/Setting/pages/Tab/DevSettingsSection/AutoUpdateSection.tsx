import { Button, Dialog, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SectionPressItem } from './SectionPressItem';

export function AutoUpdateSection() {
  if (
    platformEnv.isNativeAndroid ||
    (platformEnv.isDesktop &&
      !platformEnv.isMas &&
      !platformEnv.isDesktopLinuxSnap &&
      !platformEnv.isDesktopWinMsStore)
  ) {
    return (
      <SectionPressItem
        icon="ErrorOutline"
        title="Auto-Update failed test suits"
        onPress={() => {
          Dialog.cancel({
            title: 'Change Update Status',
            description: `Change Update Status`,
            floatingPanelProps: {
              w: '$80',
            },
            renderContent: (
              <YStack gap="$1">
                <Button
                  onPress={() => {
                    void backgroundApiProxy.serviceAppUpdate.downloadPackageFailed(
                      {
                        message: '404',
                      },
                    );
                  }}
                >
                  Download Package failed
                </Button>
                <Button
                  onPress={() => {
                    void backgroundApiProxy.serviceAppUpdate.downloadASCFailed({
                      message: '404',
                    });
                  }}
                >
                  Download ASC
                  failed(update_signature_verification_failed_alert_text)
                </Button>
                <Button
                  onPress={() => {
                    void backgroundApiProxy.serviceAppUpdate.verifyASCFailed({
                      message:
                        ETranslations.update_signature_verification_failed_alert_text,
                    });
                  }}
                >
                  verify ASC
                  failed(update_signature_verification_failed_alert_text)
                </Button>
                <Button
                  onPress={() => {
                    void backgroundApiProxy.serviceAppUpdate.verifyASCFailed({
                      message:
                        ETranslations.update_installation_package_possibly_compromised,
                    });
                  }}
                >
                  verify ASC
                  failed(update_installation_package_possibly_compromised)
                </Button>
                <Button
                  onPress={() => {
                    void backgroundApiProxy.serviceAppUpdate.verifyPackageFailed(
                      {
                        message:
                          ETranslations.update_installation_package_possibly_compromised,
                      },
                    );
                  }}
                >
                  verify package
                  failed(update_installation_package_possibly_compromised)
                </Button>
                <Button
                  onPress={() => {
                    void backgroundApiProxy.serviceAppUpdate.verifyPackageFailed(
                      {
                        message:
                          ETranslations.update_installation_not_safe_alert_text,
                      },
                    );
                  }}
                >
                  verify package failed(update_installation_not_safe_alert_text)
                </Button>
                <Button
                  onPress={() => {
                    void backgroundApiProxy.serviceAppUpdate.resetToInComplete();
                  }}
                >
                  install incomplete
                </Button>
                <Button
                  onPress={() => {
                    void backgroundApiProxy.serviceAppUpdate.resetToManualInstall();
                  }}
                >
                  manual install
                </Button>
              </YStack>
            ),
          });
        }}
      />
    );
  }
  return null;
}
