import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, YStack } from '@onekeyhq/components';
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
              autoExecuteParsedAction: true,
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
    <YStack>
      <Alert
        type="info"
        fullBleed
        borderWidth={0}
        icon="InfoCircleSolid"
        title={perpConfigCommon?.perpBannerConfig?.title}
        description={perpConfigCommon?.perpBannerConfig?.description}
        action={action}
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
      />
    </YStack>
  );
}
