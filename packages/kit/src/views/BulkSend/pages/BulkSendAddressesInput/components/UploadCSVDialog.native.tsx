import { useCallback, useState } from 'react';

import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';

import {
  Button,
  Dialog,
  Icon,
  SizableText,
  Spinner,
  Stack,
  Toast,
  XStack,
  useDialogInstance,
} from '@onekeyhq/components';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';

const MAX_LINES = 500;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const CHUNK_SIZE = 64 * 1024; // 64KB chunks

type IUploadCSVContentProps = {
  onUploaded?: (lines: string[]) => void;
};

// Streaming file reader - reads file in chunks to avoid loading entire file into memory
async function readFileStreamingLines(
  filePath: string,
  maxLines: number,
): Promise<string[]> {
  if (!RNFS) {
    Toast.error({ title: 'File system not available' });
    return [];
  }
  const lines: string[] = [];
  const stat = await RNFS.stat(filePath);
  const fileSize = stat.size;

  let position = 0;
  let buffer = '';

  while (position < fileSize && lines.length < maxLines) {
    const bytesToRead = Math.min(CHUNK_SIZE, fileSize - position);
    const chunk = await RNFS.read(filePath, bytesToRead, position, 'utf8');
    buffer += chunk;
    position += bytesToRead;

    // Extract complete lines from buffer
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1 && lines.length < maxLines) {
      let lineEnd = newlineIndex;
      // Handle \r\n
      if (newlineIndex > 0 && buffer[newlineIndex - 1] === '\r') {
        lineEnd = newlineIndex - 1;
      }
      const line = buffer.slice(0, lineEnd).trim();
      if (line) {
        lines.push(line);
      }
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf('\n');
    }
  }

  // Handle remaining buffer as last line
  if (lines.length < maxLines) {
    const lastLine = buffer.trim();
    if (lastLine) {
      lines.push(lastLine);
    }
  }

  return lines;
}

function UploadCSVContent({ onUploaded }: IUploadCSVContentProps) {
  const dialog = useDialogInstance();
  const [isLoading, setIsLoading] = useState(false);

  const handleUploadClick = useCallback(async () => {
    try {
      const [result] = await pick({
        type: [types.plainText, types.csv],
      });

      if (!result?.uri) {
        Toast.error({ title: 'Failed to access file' });
        return;
      }

      // Check file size before copying
      if (result.size && result.size > MAX_FILE_SIZE) {
        Toast.error({ title: 'File too large. Maximum size is 5MB' });
        return;
      }

      setIsLoading(true);

      // Copy file to local cache for reading
      const [localCopyResult] = await keepLocalCopy({
        files: [{ uri: result.uri, fileName: result.name ?? 'upload.csv' }],
        destination: 'cachesDirectory',
      });

      if (localCopyResult.status !== 'success') {
        Toast.error({ title: 'Failed to copy file' });
        setIsLoading(false);
        return;
      }

      const filePath = localCopyResult.localUri.replace(/^file:\/\//, '');
      // Read MAX_LINES + 1 to detect if file exceeds limit
      const lines = await readFileStreamingLines(filePath, MAX_LINES);

      if (lines.length === 0) {
        Toast.error({ title: 'File is empty' });
        setIsLoading(false);
        return;
      }

      // Skip header row if it looks like a CSV header
      if (lines[0] && lines[0].toLowerCase().includes('address')) {
        lines.shift();
      }

      if (lines.length === 0) {
        Toast.error({ title: 'File is empty' });
        setIsLoading(false);
        return;
      }

      if (lines.length >= MAX_LINES) {
        Toast.warning({
          title: `Only first ${MAX_LINES} lines will be processed`,
        });
      }

      onUploaded?.(lines);
      void dialog.close();
    } catch (error) {
      const isCanceled =
        isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED;
      if (!isCanceled) {
        Toast.error({ title: 'Failed to read file' });
      }
    } finally {
      setIsLoading(false);
    }
  }, [onUploaded, dialog]);

  const handleDownloadTemplate = useCallback(() => {
    Toast.message({ title: 'Template download not supported on mobile' });
  }, []);

  return (
    <Stack gap="$3">
      {/* Upload Area */}
      <Stack
        bg="$bgSubdued"
        borderWidth={2}
        borderColor="$borderSubdued"
        borderStyle="dashed"
        borderRadius="$3"
        py="$8"
        px="$5"
        alignItems="center"
        gap="$3"
        onPress={isLoading ? undefined : handleUploadClick}
        cursor={isLoading ? 'default' : 'pointer'}
        hoverStyle={isLoading ? undefined : { bg: '$bgHover' }}
        pressStyle={isLoading ? undefined : { bg: '$bgActive' }}
      >
        {isLoading ? (
          <Spinner size="large" />
        ) : (
          <>
            <Stack bg="$bgStrong" p="$2" borderRadius="$full">
              <Icon name="UploadOutline" size="$6" color="$icon" />
            </Stack>
            <SizableText size="$bodyMdMedium" textAlign="center">
              Click to upload CSV
            </SizableText>
          </>
        )}
      </Stack>

      {/* Template Info Row */}
      <XStack
        bg="$bgSubdued"
        borderWidth="$px"
        borderColor="$borderSubdued"
        borderRadius="$3"
        px="$4"
        py="$3.5"
        alignItems="center"
        gap="$2"
      >
        <Icon name="InfoCircleOutline" size="$5" color="$iconSubdued" />
        <SizableText size="$bodyMdMedium" flex={1}>
          Need a format?
        </SizableText>
        <Button
          size="small"
          variant="tertiary"
          icon="DownloadOutline"
          onPress={handleDownloadTemplate}
        >
          Template
        </Button>
      </XStack>
    </Stack>
  );
}

type IShowUploadCSVDialogParams = {
  onUploaded?: (lines: string[]) => void;
};

function showUploadCSVDialog(params?: IShowUploadCSVDialogParams) {
  return Dialog.show({
    title: 'Upload',
    showFooter: false,
    renderContent: <UploadCSVContent onUploaded={params?.onUploaded} />,
  });
}

export { UploadCSVContent, showUploadCSVDialog };
