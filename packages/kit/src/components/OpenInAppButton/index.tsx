import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Dialog,
  QRCode,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import Logo from '@onekeyhq/kit/assets/logo_round_decorated.png';
import { DOWNLOAD_MOBILE_APP_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import openUrlUtils, {
  openUrlExternal,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

import { usePromiseResult } from '../../hooks/usePromiseResult';

export function OpenInAppButton({
  buildDeepLinkUrl,
  buildFullUrl,
}: {
  buildDeepLinkUrl: () => string;
  buildFullUrl: () => string;
}) {
  const intl = useIntl();
  const { result: deepLinkUrl } = usePromiseResult(async () => {
    if (platformEnv.isWeb || platformEnv.isExtension) {
      const url = buildDeepLinkUrl();
      if (await openUrlUtils.linkingCanOpenURL(url)) {
        return url;
      }
    }
    return '';
  }, [buildDeepLinkUrl]);

  const openByAppButtonLabel = useMemo<string | undefined>(() => {
    if (!platformEnv.isWebMobile) {
      return 'Open by OneKey Desktop';
    }
    if (platformEnv.isWebMobileAndroid) {
      return 'Open by OneKey Android';
    }

    if (platformEnv.isWebMobileIOS) {
      return 'Open by OneKey iOS';
    }
  }, []);

  const handlePress = useCallback(() => {
    const text = buildFullUrl();
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.open_in_mobile_app }),
      floatingPanelProps: {
        overflow: 'hidden',
      },
      renderContent: (
        <Stack>
          <Stack alignItems="center" justifyContent="center" overflow="hidden">
            {deepLinkUrl && openByAppButtonLabel ? (
              <Button
                mb="$4"
                onPress={() => {
                  console.log('deepLinkUrl', deepLinkUrl);
                  void openUrlUtils.linkingOpenURL(deepLinkUrl);
                }}
              >
                {openByAppButtonLabel}
              </Button>
            ) : null}
            <Stack
              p="$4"
              borderRadius="$6"
              borderCurve="continuous"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
            >
              <QRCode value={text} logo={Logo} logoSize={40} size={224} />
            </Stack>
          </Stack>
          <XStack
            m="$-5"
            mt="$5"
            py="$4"
            px="$5"
            backgroundColor="$bgSubdued"
            alignItems="center"
          >
            <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
              {intl.formatMessage({
                id: ETranslations.dont_have_mobile_app_yet,
              })}
            </SizableText>
            <Button
              size="small"
              onPress={() => {
                openUrlExternal(DOWNLOAD_MOBILE_APP_URL);
              }}
            >
              {intl.formatMessage({ id: ETranslations.global_download })}
            </Button>
          </XStack>
        </Stack>
      ),
      showFooter: false,
    });
  }, [buildFullUrl, deepLinkUrl, intl, openByAppButtonLabel]);

  return (
    <Button size="small" onPress={handlePress}>
      {intl.formatMessage({ id: ETranslations.open_in_mobile_app })}
    </Button>
  );
}
