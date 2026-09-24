import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { Alert, BackHandler } from 'react-native';

import {
  Dialog,
  rootNavigationRef,
  usePreventRemove,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

let isNavExitConfirmShow = false;
let isAppExitConfirmed = false;

type INavigationRemoveAction = Readonly<{
  type: string;
  payload?: object | undefined;
  source?: string | undefined;
  target?: string | undefined;
}>;

export function useModalExitPrevent({
  title,
  message,
  shouldPreventRemove = true,
  onConfirm,
  isExitCurrent,
}: {
  title: string;
  message: string;
  shouldPreventRemove?: boolean;
  onConfirm?: () => Promise<boolean | void> | boolean | void;
  isExitCurrent?: () => Promise<boolean> | boolean;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isFocused = useRouteIsFocused();
  const [isNavExitConfirmed, setIsNavExitConfirmed] = useState(false);
  const confirmedRemoveActionRef = useRef<
    | {
        action: INavigationRemoveAction;
        isExitCurrent?: () => Promise<boolean> | boolean;
      }
    | undefined
  >(undefined);

  useEffect(() => {
    if (!isNavExitConfirmed) {
      return;
    }
    let cancelled = false;
    const replayTimer = setTimeout(() => {
      const confirmation = confirmedRemoveActionRef.current;
      confirmedRemoveActionRef.current = undefined;
      if (!confirmation) return;
      void (async () => {
        if ((await confirmation.isExitCurrent?.()) === false || cancelled) {
          if (!cancelled) setIsNavExitConfirmed(false);
          return;
        }
        rootNavigationRef.current?.dispatch(confirmation.action);
      })().catch((error: unknown) => {
        if (!cancelled) setIsNavExitConfirmed(false);
        console.error('Failed to confirm transfer navigation exit', error);
      });
    });
    const timer = setTimeout(() => {
      setIsNavExitConfirmed(false);
    }, 1000);
    return () => {
      cancelled = true;
      clearTimeout(replayTimer);
      clearTimeout(timer);
    };
  }, [isNavExitConfirmed, navigation]);

  const navPreventRemoveCallback = useCallback(
    ({
      data,
    }: {
      data: {
        action: INavigationRemoveAction;
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
        disableDrag: true,
        dismissOnOverlayPress: false,
        onConfirm: async () => {
          const confirmed = await onConfirm?.();
          isNavExitConfirmShow = false;
          if (confirmed === false) return;
          confirmedRemoveActionRef.current = {
            action: data.action,
            isExitCurrent,
          };
          setIsNavExitConfirmed(true);
        },
        onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
        onClose: () => {
          isNavExitConfirmShow = false;
        },
      });
    },
    [message, navigation, title, intl, onConfirm, isExitCurrent],
  );
  usePreventRemove(
    shouldPreventRemove && !isNavExitConfirmed && isFocused,
    navPreventRemoveCallback,
  );
}

export function useAppExitPrevent({
  message,
  title,
  shouldPreventExitOnAndroid = true,
  onConfirm,
  isExitCurrent,
}: {
  message: string;
  title: string;
  shouldPreventExitOnAndroid?: boolean;
  onConfirm?: () => Promise<boolean | void> | boolean | void;
  isExitCurrent?: () => Promise<boolean> | boolean;
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
              if ((await onConfirm?.()) === false) return;
              if ((await isExitCurrent?.()) === false) return;
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
  }, [
    message,
    title,
    intl,
    shouldPreventExitOnAndroid,
    navigation,
    onConfirm,
    isExitCurrent,
  ]);
}
