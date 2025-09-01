import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

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
import { airGapUrUtils } from '@onekeyhq/qr-wallet-sdk';
import { OneKeyRequestDeviceQR } from '@onekeyhq/qr-wallet-sdk/src/OneKeyRequestDeviceQR';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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

  const { width } = useWindowDimensions();
  return (
    <YStack
      p="$5"
      tabIndex={-1}
      // Web platform needs specified width, but native can inherit parent width
      w={platformEnv.isNative ? '100%' : width - 40}
      $gtMd={
        platformEnv.isNative
          ? undefined
          : {
              maxWidth: '$96',
            }
      }
    >
      <XStack ai="center" pb="$3">
        <SizableText size="$headingLg" flex={1}>
          {title ||
            intl.formatMessage({ id: ETranslations.global_confirm_on_device })}
        </SizableText>
        <IconButton
          title={
            show
              ? intl.formatMessage({ id: ETranslations.global_collapse })
              : intl.formatMessage({ id: ETranslations.global_expand })
          }
          variant="tertiary"
          size="small"
          onPressIn={toggleShowState}
          icon={show ? 'MinimizeOutline' : 'ExpandOutline'}
        />
      </XStack>
      <HeightTransition>
        {show ? (
          <Stack>
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
                size={256}
              />
            </Stack>
          </Stack>
        ) : null}
      </HeightTransition>
      <Stack pb="$5" gap="$2">
        <XStack gap="$2">
          <Stack
            borderRadius="$full"
            w="$5"
            h="$5"
            justifyContent="center"
            alignItems="center"
            bg="$bgInfo"
          >
            <SizableText size="$bodySm" color="$textInfo">
              1
            </SizableText>
          </Stack>
          <SizableText
            flex={1}
            size="$bodyMd"
            onPress={() => {
              console.log('SecureQRToastContent', value, valueUr);
              if (valueUr) {
                const qrcodeDetails = airGapUrUtils.urToQrcode(valueUr);
                console.log(qrcodeDetails);
                if (
                  valueUr &&
                  qrcodeDetails.single?.startsWith('ur:onekey-app-call-device/')
                ) {
                  const data = OneKeyRequestDeviceQR.fromUR(valueUr);
                  console.log(data);
                }
              }
            }}
          >
            {message ||
              intl.formatMessage({
                id: ETranslations.scan_qr_code_to_verify_details,
              })}
          </SizableText>
        </XStack>
        <XStack gap="$2">
          <Stack
            borderRadius="$full"
            w="$5"
            h="$5"
            justifyContent="center"
            alignItems="center"
            bg="$bgInfo"
          >
            <SizableText size="$bodySm" color="$textInfo">
              2
            </SizableText>
          </Stack>
          <SizableText
            flex={1}
            size="$bodyMd"
            onPress={() => {
              console.log('SecureQRToastContent', value, valueUr);
              if (valueUr) {
                const qrcodeDetails = airGapUrUtils.urToQrcode(valueUr);
                console.log(qrcodeDetails);
              }
            }}
          >
            {intl.formatMessage({
              id: ETranslations.secure_qr_toast_scan_qr_code_on_device_text,
            })}
          </SizableText>
        </XStack>
      </Stack>
      <XStack gap="$2.5">
        <Button variant="secondary" onPressIn={handleCancel} flex={1}>
          {intl.formatMessage({ id: ETranslations.global_cancel })}
        </Button>
        {showConfirmButton ? (
          <Button variant="primary" onPressIn={handleConfirm} flex={1}>
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
