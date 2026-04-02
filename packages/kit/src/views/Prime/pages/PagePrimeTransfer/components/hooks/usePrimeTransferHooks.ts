import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';
import { Alert, BackHandler } from 'react-native';

import { Dialog, usePreventRemove } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

let isNavExitConfirmShow = false;
let isAppExitConfirmed = false;

export function useModalExitPrevent({
  title,
  message,
  shouldPreventRemove = true,
  onConfirm,
}: {
  title: string;
  message: string;
  shouldPreventRemove?: boolean;
  onConfirm?: () => void;
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
      if (isAppExitConfirmed) {
        isAppExitConfirmed = false;
        navigation.dispatch(data.action);
        return;
      }
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
          onConfirm?.();
        },
        onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
        onClose: () => {
          isNavExitConfirmShow = false;
        },
      });
    },
    [message, navigation, title, intl, onConfirm],
  );
  usePreventRemove(shouldPreventRemove, navPreventRemoveCallback);
}

export function useAppExitPrevent({
  message,
  title,
  shouldPreventExitOnAndroid = true,
  onConfirm,
}: {
  message: string;
  title: string;
  shouldPreventExitOnAndroid?: boolean;
  onConfirm?: () => Promise<void> | void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

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

  // Prevent Android exit
  useEffect(() => {
    if (!shouldPreventExitOnAndroid) {
      return;
    }
    const onBackPress = () => {
      Alert.alert(
        title,
        message,
        [
          {
            text: intl.formatMessage({ id: ETranslations.global_cancel }),
            onPress: () => {
              // Do nothing
            },
            style: 'cancel',
          },
          {
            text: intl.formatMessage({ id: ETranslations.global_quit }),
            onPress: async () => {
              await onConfirm?.();
              isAppExitConfirmed = true;
              navigation.popStack();
              setTimeout(() => {
                isAppExitConfirmed = false;
              }, 300);
            },
          },
        ],
        { cancelable: false },
      );

      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    );

    return () => backHandler.remove();
  }, [message, title, intl, shouldPreventExitOnAndroid, navigation, onConfirm]);
}
