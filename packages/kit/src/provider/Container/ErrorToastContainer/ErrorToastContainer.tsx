import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import { Toast, useClipboard } from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function ErrorToastContainer() {
  const intl = useIntl();
  const { copyText } = useClipboard();
  useEffect(() => {
    const fn = (p: IAppEventBusPayload[EAppEventBusNames.ShowToast]) => {
      let message: string | undefined;
      if (p.hideRequestId && p.message) {
        message = p.message;
      } else if (p?.message) {
        message = `RequestId: ${p.message}`;
      }
      const actionsProps: IButtonProps | undefined = message
        ? {
            children: intl.formatMessage({ id: ETranslations.global_copy }),
            my: '$2',
            size: 'small',
            onPress: () => {
              copyText(message);
            },
          }
        : undefined;
      Toast[p.method]({
        ...p,
        message,
        actionsProps,
      });
    };
    appEventBus.on(EAppEventBusNames.ShowToast, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowToast, fn);
    };
  }, [copyText, intl]);

  return null;
}
