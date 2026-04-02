import { memo, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { PreCheckBeforeSendingCancelError } from '@onekeyhq/shared/src/errors/errors/appErrors';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function BasicPrevCheckBeforeSendingContainer() {
  const intl = useIntl();
  useEffect(() => {
    const onConfirmText = intl.formatMessage({
      id: ETranslations.global_confirm,
    });
    const handler = ({
      promiseId,
      type,
    }: {
      promiseId: number;
      type: 'scam' | 'contract';
    }) => {
      const onConfirm = async () => {
        await backgroundApiProxy.servicePromise.resolveCallback({
          id: promiseId,
          data: false,
        });
      };
      const onCancel = async () => {
        await backgroundApiProxy.servicePromise.rejectCallback({
          id: promiseId,
          error: toPlainErrorObject(new PreCheckBeforeSendingCancelError()),
        });
      };
      const commonDialogProps = {
        icon: 'ShieldCheckDoneOutline' as const,
        title: intl.formatMessage({
          id: ETranslations.global_warning,
        }),
        onConfirmText,
        onConfirm,
        onCancel,
      };
      switch (type) {
        case 'scam':
          Dialog.show({
            ...commonDialogProps,
            description: intl.formatMessage({
              id: ETranslations.send_label_scam,
            }),
          });
          break;
        case 'contract':
          Dialog.show({
            ...commonDialogProps,
            description: intl.formatMessage({
              id: ETranslations.address_input_contract_popover,
            }),
          });
          break;
        default:
          console.warn(`Unhandled address check type: ${type as string}`);
          void onCancel();
          break;
      }
    };
    appEventBus.on(EAppEventBusNames.CheckAddressBeforeSending, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.CheckAddressBeforeSending, handler);
    };
  }, [intl]);
  return null;
}

export const PrevCheckBeforeSendingContainer = memo(
  BasicPrevCheckBeforeSendingContainer,
);
