import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, usePreventRemove } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalFirmwareUpdateRoutes,
  IModalFirmwareUpdateParamList,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAppRoute } from '../../../hooks/useAppRoute';

import { useFirmwareUpdateActions } from './useFirmwareUpdateActions';

let isNavExitConfirmShow = false;

export function useModalExitPrevent({
  title,
  message,
  shouldPreventRemove = true,
}: {
  title: string;
  message: string;
  shouldPreventRemove?: boolean;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const navPreventRemoveCallback = useCallback(
    ({
      data,
    }: {
      data: {
        action: Readonly<{
          type: string;
          payload?: object | undefined;
          source?: string | undefined;
          target?: string | undefined;
        }>;
      };
    }) => {
      if (isNavExitConfirmShow) {
        return;
      }
      isNavExitConfirmShow = true;
      Dialog.show({
        title,
        description: message,
        onConfirmText: intl.formatMessage({ id: ETranslations.global_quit }),
        onConfirm: () => {
          navigation.dispatch(data.action);
        },
        onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
        onClose: () => {
          isNavExitConfirmShow = false;
        },
      });
    },
    [message, navigation, title, intl],
  );
  usePreventRemove(shouldPreventRemove, navPreventRemoveCallback);
}

export function useAppExitPrevent({
  message,
  title,
}: {
  message: string;
  title: string;
}) {
  // Prevents web page refresh/exit
  useEffect(() => {
    if (platformEnv.isRuntimeBrowser && !platformEnv.isExtensionUiPopup) {
      const fn = (event: BeforeUnloadEvent) => {
        event.preventDefault();
        event.returnValue = true;
        return message;
      };
      window.addEventListener('beforeunload', fn);
      return () => {
        window.removeEventListener('beforeunload', fn);
      };
    }
  }, [message]);
}

export function useExtensionUpdatingFromExpandTab() {
  const route = useAppRoute<
    IModalFirmwareUpdateParamList,
    EModalFirmwareUpdateRoutes.ChangeLog
  >();
  const actions = useFirmwareUpdateActions();

  useEffect(() => {
    if (platformEnv.isExtensionUiPopup) {
      void actions.openChangeLogOfExtension(route.params);
      window.close();
    }
  }, [actions, route.params]);
}
