import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IShowToasterProps } from '@onekeyhq/components';
import {
  Button,
  HeightTransition,
  IconButton,
  QRCode,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  useToaster,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const SecureQRToastBase = ({
  value,
  showQRCode,
  onConfirm,
  onCancel,
}: {
  value: string;
  showQRCode: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}) => {
  const intl = useIntl();
  const { close } = useToaster();
  const [show, setShow] = useState(showQRCode);
  const handleCancel = useCallback(async () => {
    await close();
    onCancel?.();
  }, [close, onCancel]);
  const handleConfirm = useCallback(async () => {
    await close();
    onConfirm?.();
  }, [close, onConfirm]);
  return (
    <YStack p="$5" tabIndex={-1}>
      <XStack ai="center" pb="$5">
        <SizableText size="$headingLg" flex={1}>
          Confirm on device
        </SizableText>
        <Stack>
          <IconButton
            variant="tertiary"
            size="small"
            onPress={() => {
              setShow(!show);
            }}
            icon={show ? 'MinimizeOutline' : 'ExpandOutline'}
            color="$iconSubdued"
          />
        </Stack>
      </XStack>
      <HeightTransition>
        {show ? (
          <Stack
            ai="center"
            animation="slow"
            exitStyle={{
              opacity: 0,
            }}
            enterStyle={{
              opacity: 0,
            }}
            pb="$5"
          >
            <QRCode drawType="line" value={value} size={240} />
          </Stack>
        ) : null}
      </HeightTransition>
      <SizableText size="$bodyLg" pb="$5">
        Scan the QR code with your device to verify the details.
      </SizableText>
      <XStack space="$2.5">
        <Button variant="secondary" onPress={handleCancel} flex={1}>
          {intl.formatMessage({ id: ETranslations.global_cancel })}
        </Button>
        <Button variant="primary" onPress={handleConfirm} flex={1}>
          Next
        </Button>
      </XStack>
    </YStack>
  );
};

export const SecureQRToast = {
  show: ({
    value,
    showQRCode = true,
    onConfirm,
    onCancel,
    onClose,
  }: {
    value: string;
    showQRCode?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
    onClose?: IShowToasterProps['onClose'];
  }) => {
    Toast.show({
      children: (
        <SecureQRToastBase
          value={value}
          showQRCode={showQRCode}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      ),
      onClose,
    });
  },
};
