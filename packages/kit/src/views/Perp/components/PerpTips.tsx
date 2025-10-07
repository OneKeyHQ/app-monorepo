import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
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
      primary: intl.formatMessage({ id: ETranslations.global_view }),
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
    <Alert
      flex={1}
      type={perpConfigCommon?.perpBannerConfig?.alertType ?? 'default'}
      fullBleed
      title={perpConfigCommon?.perpBannerConfig?.title}
      description={perpConfigCommon?.perpBannerConfig?.description}
      closable={!!perpConfigCommon?.perpBannerConfig?.canClose}
      action={action}
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
  );
}
