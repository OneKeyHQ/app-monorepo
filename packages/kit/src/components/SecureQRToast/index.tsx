import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IQRCodeProps, IShowToasterProps } from '@onekeyhq/components';
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
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ISecureQRToastBaseProps {
  title?: string;
  message?: string;
  value?: string;
  valueUr?: IQRCodeProps['valueUr'];
  showQRCode?: boolean;
  drawType?: IQRCodeProps['drawType'];
  onConfirm?: () => void;
  onConfirmText?: string;
  onCancel?: () => void;
  showConfirmButton?: boolean;
}

const SecureQRToastBase = ({
  title,
  message,
  value,
  valueUr,
  showQRCode,
  onConfirm,
  onConfirmText,
  onCancel,
  showConfirmButton = true,
  drawType = 'line',
}: ISecureQRToastBaseProps) => {
  const intl = useIntl();
  const [show, setShow] = useState(showQRCode);
  const toggleShowState = useCallback(() => {
    setShow(!show);
  }, [show]);
  const handleCancel = useCallback(async () => {
    onCancel?.();
  }, [onCancel]);
  const handleConfirm = useCallback(async () => {
    onConfirm?.();
  }, [onConfirm]);
  return (
    <YStack
      p="$5"
      tabIndex={-1}
      $gtMd={{
        maxWidth: '$96',
      }}
    >
      <XStack ai="center" pb="$5">
        <SizableText size="$headingLg" flex={1}>
          {title ||
            intl.formatMessage({ id: ETranslations.global_confirm_on_device })}
        </SizableText>
        <Stack>
          <IconButton
            variant="tertiary"
            size="small"
            onPress={toggleShowState}
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
            <QRCode
              drawType={drawType}
              value={value}
              valueUr={valueUr}
              size={240}
            />
          </Stack>
        ) : null}
      </HeightTransition>
      <SizableText size="$bodyLg" pb="$5">
        {message ||
          intl.formatMessage({
            id: ETranslations.san_qr_code_to_verify_details,
          })}
      </SizableText>
      <XStack space="$2.5">
        <Button variant="secondary" onPress={handleCancel} flex={1}>
          {intl.formatMessage({ id: ETranslations.global_cancel })}
        </Button>
        {showConfirmButton ? (
          <Button variant="primary" onPress={handleConfirm} flex={1}>
            {onConfirmText ||
              intl.formatMessage({
                id: ETranslations.global_next,
              })}
          </Button>
        ) : null}
      </XStack>
    </YStack>
  );
};

export const SecureQRToast = {
  show: ({
    title,
    message,
    value,
    valueUr,
    showQRCode = true,
    onConfirm,
    onCancel,
    drawType,
    onConfirmText,
    showConfirmButton,
    ...props
  }: ISecureQRToastBaseProps & IShowToasterProps) =>
    Toast.show({
      children: (
        <SecureQRToastBase
          title={title}
          message={message}
          value={value}
          valueUr={valueUr}
          drawType={drawType}
          showQRCode={showQRCode}
          onConfirm={onConfirm}
          onConfirmText={onConfirmText}
          onCancel={onCancel}
          showConfirmButton={showConfirmButton}
        />
      ),
      ...props,
    }),
};
