import { Button, Dialog, SizableText, YStack } from '@onekeyhq/components';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';

import { SectionPressItem } from './SectionPressItem';

export function AutoUpdateDevSettings() {
  return (
    <SectionPressItem
      icon="AppleBrand"
      title="Test Auto Update"
      onPress={async () => {
        Dialog.show({
          title: 'Auto Update Test Result',
          renderContent: (
            <YStack p="$4" gap="$3">
              <Button
                variant="primary"
                onPress={async () => {
                  try {
                    const result = await BundleUpdate.testVerification();
                    Dialog.show({
                      title: 'Test Result',
                      renderContent: (
                        <YStack p="$4">
                          <SizableText>
                            Verification Result: {result ? 'Success' : 'Failed'}
                          </SizableText>
                        </YStack>
                      ),
                    });
                  } catch (error) {
                    Dialog.show({
                      title: 'Test Error',
                      renderContent: (
                        <YStack p="$4">
                          <SizableText>
                            Error:{' '}
                            {(error as Error)?.message || 'Unknown error'}
                          </SizableText>
                        </YStack>
                      ),
                    });
                  }
                }}
              >
                Test Verification
              </Button>
            </YStack>
          ),
        });
      }}
    />
  );
}
