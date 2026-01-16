import { useCallback, useState } from 'react';

import { Button, Input, Toast, YStack } from '@onekeyhq/components';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

const DEBUG_KEY = '$$test_async_storage_size_key';

function SaveDataButton({
  onSaveData,
}: {
  onSaveData: (size: number) => Promise<void>;
}) {
  const [size, setSize] = useState<string | undefined>(undefined);
  return (
    <YStack padding={12}>
      <Input
        placeholder="Enter size in MB"
        onChangeText={(text) => {
          setSize(text);
        }}
        value={size?.toString()}
        keyboardType="decimal-pad"
      />
      <Button
        onPress={async () => {
          if (size) {
            await onSaveData(parseFloat(size ?? '0'));
          }
        }}
      >
        Save data
      </Button>
    </YStack>
  );
}

export function AsyncStorageDevSettings() {
  const saveData = useCallback(async (size: number) => {
    const oldData = (await appStorage.getItem(DEBUG_KEY)) || '';
    const newData = oldData + 'a'.repeat(size * 1024 * 1024);
    await appStorage.setItem(DEBUG_KEY, newData);
    Toast.success({
      title: 'Save data success',
    });
  }, []);

  return (
    <YStack gap={4}>
      <Button
        onPress={async () => {
          await appStorage.removeItem(DEBUG_KEY);
          Toast.success({
            title: 'Clear data success',
          });
        }}
      >
        Clear data
      </Button>

      <Button
        onPress={async () => {
          try {
            const data = await appStorage.getItem(DEBUG_KEY);
            const sizeInMB = data
              ? (data.length / (1024 * 1024.0)).toFixed(2)
              : 0;
            Toast.success({
              title: 'Saved data size',
              message: `size: ${sizeInMB} MB`,
            });
          } catch (e: any) {
            const { message } = e;
            Toast.error({
              title: 'Read data size failed',
              message,
            });
          }
        }}
      >
        Read data size
      </Button>

      <SaveDataButton onSaveData={saveData} />

      <Button
        onPress={async () => {
          await saveData(1);
        }}
      >
        Save 1M Data
      </Button>

      <Button
        onPress={async () => {
          await saveData(10);
        }}
      >
        Save 10M Data
      </Button>
    </YStack>
  );
}
