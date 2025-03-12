import { useIntl } from 'react-intl';

import { Image, Page, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export default function ManualInstall() {
  const intl = useIntl();
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.update_update_incomplete_title,
        })}
      />
      <Page.Body>
        <YStack px="$5" gap="$3">
          <SizableText size="$bodyMd">
            {intl.formatMessage({
              id: ETranslations.update_update_incomplete_desc,
            })}
          </SizableText>
          <Image
            h="$96"
            source={require('@onekeyhq/kit/assets/manual_install.jpg')}
          />
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.update_update_incomplete_footnote,
            })}
          </SizableText>
        </YStack>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.update_manual_update,
        })}
        onConfirm={async () => {
          const params =
            await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
          globalThis.desktopApi.manualInstallUpdate({
            ...params,
            buildNumber: String(platformEnv.buildNumber || 1),
          });
        }}
      />
    </Page>
  );
}

// Dialog.confirm({
//     title: intl.formatMessage({
//       id: ETranslations.update_update_incomplete_title,
//     }),
// description: intl.formatMessage({
//   id: ETranslations.update_update_incomplete_desc,
// }),
//     renderContent: (
//   <Image
//     h={226}
//     source={require('@onekeyhq/kit/assets/manual_install.jpg')}
//   />
//     ),
// onConfirmText: intl.formatMessage({
//   id: ETranslations.update_manual_update,
// }),
// onConfirm: async () => {
//   const params =
//     await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
//   globalThis.desktopApi.manualInstallUpdate({
//     ...params,
//     buildNumber: String(platformEnv.buildNumber || 1),
//   });
// },
//   });
