import { useState } from 'react';

import {
  Dialog,
  IconButton,
  QRCode,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';

const SecureQRToastBase = ({
  value,
  showQRCode,
}: {
  value: string;
  showQRCode: boolean;
}) => {
  const [show, setShow] = useState(showQRCode);
  return (
    <Stack mt="$5">
      <XStack ai="center">
        <SizableText size="$headingLg" flex={1}>
          Confirm on device
        </SizableText>
        <Stack>
          <IconButton
            variant="tertiary"
            size="small"
            onPress={() => {
              Toast.show({
                children: (
                  <SecureQRToastBase value={value} showQRCode={showQRCode} />
                ),
              });
            }}
            icon={show ? 'MinimizeOutline' : 'ExpandOutline'}
            color="$iconSubdued"
          />
        </Stack>
      </XStack>
      {show ? (
        <Stack ai="center" mt="$5">
          <QRCode drawType="line" value={value} size={240} />
        </Stack>
      ) : null}
      <SizableText size="$bodyLg" mt="$5">
        Scan the QR code with your device to verify the details.
      </SizableText>
    </Stack>
  );
};

export const SecureQRToast = {
  show: ({
    value,
    showQRCode = true,
  }: {
    value: string;
    showQRCode?: boolean;
  }) =>
    new Promise((resolve, reject) => {
      Dialog.show({
        renderContent: (
          <SecureQRToastBase value={value} showQRCode={showQRCode} />
        ),
        showExitButton: false,
        onConfirmText: 'Next',
        onConfirm: (dialog) => {
          resolve(dialog);
        },
        onCancel: () => {
          reject();
        },
      });
    }),
};
