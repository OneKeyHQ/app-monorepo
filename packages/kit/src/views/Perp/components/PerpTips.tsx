import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { usePerpsCommonConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EQRCodeHandlerNames } from '@onekeyhq/shared/types/qrCode';

import useParseQRCode from '../../ScanQrCode/hooks/useParseQRCode';

export function PerpTips() {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const [{ perpConfigCommon }, setPerpsCommonConfigPersistAtom] =
    usePerpsCommonConfigPersistAtom();
  const parseQRCode = useParseQRCode();

  const action = useMemo(() => {
    const { href, hrefType, useSystemBrowser } =
      perpConfigCommon?.perpBannerConfig ?? {
        href: '',
        hrefType: '',
        useSystemBrowser: false,
      };
    if (!href || !hrefType) {
      return undefined;
    }

    return {
      primary: intl.formatMessage({ id: ETranslations.global_learn_more }),
      onPrimaryPress: () => {
        if (href) {
          if (hrefType === 'external') {
            if (useSystemBrowser) {
              openUrlExternal(href);
            } else {
              openUrlInApp(href);
            }
          } else {
            void parseQRCode.parse(href, {
              handlers: [
                EQRCodeHandlerNames.rewardCenter,
                EQRCodeHandlerNames.updatePreview,
              ],
              qrWalletScene: false,
              autoHandleResult: true,
              defaultHandler: openUrlExternal,
            });
          }
        }
      },
    };
  }, [intl, parseQRCode, perpConfigCommon?.perpBannerConfig]);

  if (
    !perpConfigCommon?.perpBannerConfig ||
    perpConfigCommon?.perpBannerClosedIds?.includes(
      perpConfigCommon?.perpBannerConfig?.id,
    )
  ) {
    return null;
  }
  return (
    <YStack borderBottomWidth="$px" borderBottomColor="$borderSubdued">
      <Alert
        flex={1}
        bg="$bgInfo"
        type="default"
        fullBleed
        borderWidth={0}
        alignItems={gtMd ? 'center' : 'flex-start'}
        closable={!!perpConfigCommon?.perpBannerConfig?.canClose}
        onClose={() => {
          if (perpConfigCommon?.perpBannerConfig?.id) {
            void setPerpsCommonConfigPersistAtom((prev) => ({
              ...prev,
              perpConfigCommon: {
                ...prev.perpConfigCommon,
                perpBannerClosedIds: [
                  perpConfigCommon?.perpBannerConfig?.id ?? '',
                ],
              },
            }));
          }
        }}
      >
        <XStack gap="$3" alignItems={gtMd ? 'center' : 'flex-start'} flex={1}>
          <Stack p="$1" bg="$bgInfo" borderRadius="$full" flexShrink={0}>
            <Icon name="InfoCircleSolid" size="$4" color="$iconInfo" />
          </Stack>
          <YStack gap="$1" flex={1}>
            {perpConfigCommon?.perpBannerConfig?.title ? (
              <SizableText size="$bodyMdMedium" color="$textSubdued">
                {perpConfigCommon.perpBannerConfig.title}
              </SizableText>
            ) : null}
            {perpConfigCommon?.perpBannerConfig?.description ? (
              <SizableText size="$bodyMd" color="$textSubdued">
                {perpConfigCommon.perpBannerConfig.description}
              </SizableText>
            ) : null}
            {!gtMd && action ? (
              <Button
                size="small"
                variant="secondary"
                onPress={action.onPrimaryPress}
                flexShrink={0}
                alignSelf="flex-start"
                px="$3"
                py="$0.5"
                mt="$0.5"
              >
                <SizableText size="$bodySm">{action.primary}</SizableText>
              </Button>
            ) : null}
          </YStack>
          {gtMd && action ? (
            <Button
              size="small"
              variant="secondary"
              onPress={action.onPrimaryPress}
              flexShrink={0}
              alignSelf="center"
              px="$3"
              py="$0.5"
            >
              <SizableText size="$bodySm">{action.primary}</SizableText>
            </Button>
          ) : null}
        </XStack>
      </Alert>
    </YStack>
  );
}
