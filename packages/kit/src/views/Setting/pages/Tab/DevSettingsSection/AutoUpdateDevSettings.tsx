import { useState } from 'react';

import {
  Button,
  Dialog,
  Input,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';

import { SectionPressItem } from './SectionPressItem';

export function AutoUpdateDevSettings() {
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [bundleVersion, setBundleVersion] = useState('1');

  const showTestDialog = (
    title: string,
    testFunction: () => Promise<
      boolean | { success: boolean; message: string }
    >,
  ) => {
    Dialog.show({
      title,
      renderContent: (
        <YStack p="$4" gap="$3">
          <Input
            placeholder="App Version (e.g., 1.0.0)"
            value={appVersion}
            onChangeText={setAppVersion}
          />
          <Input
            placeholder="Bundle Version (e.g., 1)"
            value={bundleVersion}
            onChangeText={setBundleVersion}
          />
          <Button
            variant="primary"
            onPress={async () => {
              try {
                const result = await testFunction();
                Dialog.show({
                  title: 'Test Result',
                  renderContent: (
                    <YStack p="$4">
                      <SizableText>
                        {typeof result === 'boolean'
                          ? `Result: ${String(result ? 'Success' : 'Failed')}`
                          : `Success: ${String(
                              result.success,
                            )}\nMessage: ${String(result.message)}`}
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
                        Error: {(error as Error)?.message || 'Unknown error'}
                      </SizableText>
                    </YStack>
                  ),
                });
              }
            }}
          >
            Run Test
          </Button>
        </YStack>
      ),
    });
  };

  return (
    <YStack gap="$2">
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
                              Verification Result:{' '}
                              {result ? 'Success' : 'Failed'}
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

      <SectionPressItem
        icon="FolderDeleteOutline"
        title="Test Delete JsBundle"
        onPress={() => {
          showTestDialog('Test Delete JsBundle', () =>
            BundleUpdate.testDeleteJsBundle(appVersion, bundleVersion),
          );
        }}
      />

      <SectionPressItem
        icon="FoldersOutline"
        title="Test Delete Js Runtime Directory"
        onPress={() => {
          showTestDialog('Test Delete Js Runtime Directory', () =>
            BundleUpdate.testDeleteJsRuntimeDir(appVersion, bundleVersion),
          );
        }}
      />

      <SectionPressItem
        icon="FileTextOutline"
        title="Test Delete Metadata.json"
        onPress={() => {
          showTestDialog('Test Delete Metadata.json', () =>
            BundleUpdate.testDeleteMetadataJson(appVersion, bundleVersion),
          );
        }}
      />

      <SectionPressItem
        icon="FileTextOutline"
        title="Test Write Empty Metadata.json"
        onPress={() => {
          showTestDialog('Test Write Empty Metadata.json', () =>
            BundleUpdate.testWriteEmptyMetadataJson(appVersion, bundleVersion),
          );
        }}
      />
    </YStack>
  );
}
