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
  usePageWidth,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
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

  const pageWidth = usePageWidth();
  return (
    <YStack
      p="$5"
      tabIndex={-1}
      // Web platform needs specified width, but native can inherit parent width
      w={platformEnv.isNative ? '100%' : pageWidth - 40}
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
          testID="air-gap-toggle-qr-btn"
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
              animateOnly={ANIMATE_ONLY_OPACITY}
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
                void (async () => {
                  const { airGapUrUtils: lazyAirGapUrUtils } =
                    await import('@onekeyhq/qr-wallet-sdk');
                  const qrcodeDetails = lazyAirGapUrUtils.urToQrcode(valueUr);
                  console.log(qrcodeDetails);
                  if (
                    qrcodeDetails.single?.startsWith(
                      'ur:onekey-app-call-device/',
                    )
                  ) {
                    const { OneKeyRequestDeviceQR: LazyOneKeyRequestDeviceQR } =
                      await import('@onekeyhq/qr-wallet-sdk/src/OneKeyRequestDeviceQR');
                    const data = LazyOneKeyRequestDeviceQR.fromUR(valueUr);
                    console.log(data);
                  }
                })();
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
                void (async () => {
                  const { airGapUrUtils: lazyAirGapUrUtils2 } =
                    await import('@onekeyhq/qr-wallet-sdk');
                  const qrcodeDetails = lazyAirGapUrUtils2.urToQrcode(valueUr);
                  console.log(qrcodeDetails);
                })();
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
        <Button
          testID="air-gap-cancel-btn"
          variant="secondary"
          onPressIn={handleCancel}
          flex={1}
        >
          {intl.formatMessage({ id: ETranslations.global_cancel })}
        </Button>
        {showConfirmButton ? (
          <Button
            testID="air-gap-confirm-btn"
            variant="primary"
            onPressIn={handleConfirm}
            flex={1}
          >
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
