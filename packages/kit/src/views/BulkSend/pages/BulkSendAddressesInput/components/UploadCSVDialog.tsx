import type { DragEvent } from 'react';
import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const MAX_LINES = 500;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

type IUploadCSVContentProps = {
  onUploaded?: (lines: string[]) => void;
};

// Streaming file reader - reads file in chunks to avoid loading entire file into memory
async function readFileStreamingLines(
  file: File,
  maxLines: number,
): Promise<string[]> {
  const lines: string[] = [];
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (lines.length < maxLines) {
      const { done, value } = await reader.read();

      if (done) {
        // Handle remaining buffer as last line
        const lastLine = buffer.trim();
        if (lastLine && lines.length < maxLines) {
          lines.push(lastLine);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

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
  } finally {
    void reader.cancel();
  }

  return lines;
}

function isValidCSVFile(file: File): boolean {
  const validTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
  const validExtensions = ['.csv', '.txt'];
  const fileName = file.name.toLowerCase();

  return (
    validTypes.includes(file.type) ||
    validExtensions.some((ext) => fileName.endsWith(ext))
  );
}

function UploadCSVContent({ onUploaded }: IUploadCSVContentProps) {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!isValidCSVFile(file)) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_csv_invalid_type,
          }),
        });
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_csv_too_large,
          }),
        });
        return;
      }

      setIsLoading(true);
      try {
        const lines = await readFileStreamingLines(file, MAX_LINES);

        if (lines.length === 0) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.wallet_bulk_send_csv_empty,
            }),
          });
          return;
        }

        // Skip header row if it looks like a CSV header
        if (lines[0] && lines[0].toLowerCase().includes('address')) {
          lines.shift();
        }

        if (lines.length === 0) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.wallet_bulk_send_csv_empty,
            }),
          });
          return;
        }

        if (lines.length >= MAX_LINES) {
          Toast.warning({
            title: intl.formatMessage(
              { id: ETranslations.wallet_bulk_send_csv_lines_limit },
              { max: MAX_LINES },
            ),
          });
          lines.length = MAX_LINES;
        }

        onUploaded?.(lines);
        void dialog.close();
      } catch (_error) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_csv_read_failed,
          }),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [intl, onUploaded, dialog],
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void processFile(file);
      }
      // Reset input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [processFile],
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      const file = event.dataTransfer?.files?.[0];
      if (file) {
        void processFile(file);
      }
    },
    [processFile],
  );

  const handleDownloadTemplate = useCallback(() => {
    const templateContent = 'address,amount\n0x123...,1.5\n0x456...,2.0';
    const blob = new Blob([templateContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_send_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const supportsDropZone =
    platformEnv.isWeb || platformEnv.isDesktop || platformEnv.isExtension;

  return (
    <Stack gap="$3">
      {/* Hidden file input */}
      {platformEnv.isWeb || platformEnv.isDesktop || platformEnv.isExtension ? (
        <input
          ref={fileInputRef as any}
          type="file"
          accept=".csv,.txt,text/csv"
          onChange={handleFileSelect as any}
          style={{ display: 'none' }}
        />
      ) : null}

      {/* Upload Area */}
      <Stack
        bg={isDragging ? '$bgHover' : '$bgSubdued'}
        borderWidth={2}
        borderColor={isDragging ? '$borderActive' : '$borderSubdued'}
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
        {...(supportsDropZone
          ? {
              onDragOver: handleDragOver as any,
              onDragLeave: handleDragLeave as any,
              onDrop: handleDrop as any,
            }
          : {})}
      >
        {isLoading ? (
          <Spinner size="large" />
        ) : (
          <>
            <Stack bg="$bgStrong" p="$2" borderRadius="$full">
              <Icon name="UploadOutline" size="$6" color="$icon" />
            </Stack>
            <SizableText size="$bodyMdMedium" textAlign="center">
              {supportsDropZone
                ? intl.formatMessage({
                    id: ETranslations.wallet_bulk_send_csv_click_or_drag,
                  })
                : intl.formatMessage({
                    id: ETranslations.wallet_bulk_send_csv_click_to_upload,
                  })}
            </SizableText>
          </>
        )}
      </Stack>

      {/* Template Info Row */}
      <XStack py="$3.5" alignItems="center" gap="$2">
        <Icon name="InfoCircleOutline" size="$5" color="$iconSubdued" />
        <SizableText size="$bodyMdMedium" flex={1}>
          {intl.formatMessage({
            id: ETranslations.wallet_bulk_send_csv_need_format,
          })}
        </SizableText>
        <Button
          size="small"
          variant="tertiary"
          icon="DownloadOutline"
          onPress={handleDownloadTemplate}
        >
          {intl.formatMessage({
            id: ETranslations.wallet_bulk_send_btn_template,
          })}
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
    title: appLocale.intl.formatMessage({
      id: ETranslations.wallet_bulk_send_upload_title,
    }),
    showFooter: false,
    renderContent: <UploadCSVContent onUploaded={params?.onUploaded} />,
  });
}

export { UploadCSVContent, showUploadCSVDialog };
