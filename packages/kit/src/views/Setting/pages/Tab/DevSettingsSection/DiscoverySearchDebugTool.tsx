import { useCallback, useState } from 'react';

import {
  Button,
  SizableText,
  TextArea,
  Toast,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import {
  getLatestDiscoverySearchDebugSnapshot,
  stringifyDiscoverySearchDebugSnapshot,
} from '@onekeyhq/kit/src/views/Discovery/utils/searchDebugSnapshot';

export function DiscoverySearchDebugTool() {
  const { copyText } = useClipboard();
  const [snapshotText, setSnapshotText] = useState('');

  const setExportText = useCallback(
    (text: string) => {
      setSnapshotText(text);
      copyText(text);
    },
    [copyText],
  );

  const handleExportLatest = useCallback(() => {
    const snapshot = getLatestDiscoverySearchDebugSnapshot();
    if (!snapshot) {
      Toast.error({
        title: 'No Discovery search snapshot',
        message: 'Open the browser search box first, then export again.',
      });
      return;
    }

    setExportText(stringifyDiscoverySearchDebugSnapshot(snapshot));
    Toast.success({ title: 'Discovery search factors copied' });
  }, [setExportText]);

  return (
    <YStack gap="$3" p="$3">
      <YStack gap="$1">
        <SizableText size="$bodyLgMedium">Discovery Search Factors</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          Export current browser search suggestion factors for analysis.
        </SizableText>
      </YStack>

      <Button size="small" alignSelf="flex-start" onPress={handleExportLatest}>
        Export Factors
      </Button>

      <TextArea
        value={snapshotText}
        onChangeText={setSnapshotText}
        placeholder="Exported Discovery search factors JSON"
        minHeight={160}
        autoCapitalize="none"
      />
    </YStack>
  );
}
