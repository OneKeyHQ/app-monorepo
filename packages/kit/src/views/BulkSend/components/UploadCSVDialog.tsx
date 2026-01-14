import {
  Button,
  Dialog,
  Icon,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';

type IUploadCSVContentProps = {
  onUpload?: () => void;
  onDownloadTemplate?: () => void;
};

function UploadCSVContent({
  onUpload,
  onDownloadTemplate,
}: IUploadCSVContentProps) {
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
        onPress={onUpload}
        cursor="pointer"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
      >
        <Stack bg="$bgStrong" p="$2" borderRadius="$full">
          <Icon name="UploadOutline" size="$6" color="$icon" />
        </Stack>
        <SizableText size="$bodyMdMedium" textAlign="center">
          Click to upload CSV
        </SizableText>
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
          onPress={onDownloadTemplate}
        >
          Template
        </Button>
      </XStack>
    </Stack>
  );
}

type IShowUploadCSVDialogParams = {
  onUpload?: () => void;
  onDownloadTemplate?: () => void;
};

function showUploadCSVDialog(params?: IShowUploadCSVDialogParams) {
  return Dialog.show({
    title: 'Upload',
    showFooter: false,
    renderContent: (
      <UploadCSVContent
        onUpload={params?.onUpload}
        onDownloadTemplate={params?.onDownloadTemplate}
      />
    ),
  });
}

export { UploadCSVContent, showUploadCSVDialog };
