import { useEffect, useRef, useState } from 'react';

import { throttle } from 'lodash';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  type ILottieViewProps,
  LottieView,
  YStack,
  type useInTabDialog,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import type { IntlShape } from 'react-intl';

export const DIALOG_THROTTLE_TIME = timerUtils.getTimeDurationMs({
  seconds: 30,
});
export const UPDATE_DIALOG_INTERVAL = timerUtils.getTimeDurationMs({
  day: 1,
});

function resolveLottieModule(module: unknown): ILottieViewProps['source'] {
  const lottieModule = module as { default?: ILottieViewProps['source'] };
  return lottieModule.default ?? module;
}

export function LottieViewIcon({
  themeVariant,
}: {
  themeVariant: 'light' | 'dark';
}) {
  const [source, setSource] = useState<ILottieViewProps['source'] | null>(null);
  const lottieViewRef = useRef<{
    play?: () => void;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    const loader =
      themeVariant === 'light'
        ? import('@onekeyhq/kit/assets/animations/update-notification-light.json')
        : import('@onekeyhq/kit/assets/animations/update-notification-dark.json');
    void loader.then((module) => {
      if (cancelled) {
        return;
      }
      setSource(resolveLottieModule(module));
    });
    return () => {
      cancelled = true;
    };
  }, [themeVariant]);

  useEffect(() => {
    const timer = setTimeout(() => {
      lottieViewRef.current?.play?.();
    }, 550);
    return () => clearTimeout(timer);
  }, []);

  return (
    <YStack
      borderRadius="$5"
      borderCurve="continuous"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      elevation={platformEnv.isNativeAndroid ? undefined : 0.5}
      overflow="hidden"
    >
      {source ? (
        <LottieView
          ref={lottieViewRef as any}
          loop={false}
          autoPlay={false}
          height={56}
          width={56}
          source={source}
        />
      ) : (
        <YStack height={56} width={56} />
      )}
    </YStack>
  );
}

export const showSilentUpdateDialogUI = throttle(
  async ({
    intl,
    summary,
    onConfirm,
    themeVariant,
  }: {
    intl: IntlShape;
    summary: string;
    onConfirm: () => void;
    themeVariant: 'light' | 'dark';
  }) => {
    Dialog.show({
      dismissOnOverlayPress: false,
      renderIcon: <LottieViewIcon themeVariant={themeVariant} />,
      title: intl.formatMessage({
        id: ETranslations.update_notification_dialog_title,
      }),
      description:
        summary ||
        intl.formatMessage({
          id: ETranslations.update_notification_dialog_desc,
        }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.update_update_now,
      }),
      showCancelButton: false,
      onHeaderCloseButtonPress: () => {
        defaultLogger.app.component.closedInUpdateDialog();
      },
      onConfirm,
    });
  },
  DIALOG_THROTTLE_TIME,
);

export const showUpdateDialogUI = ({
  dialog,
  intl,
  themeVariant,
  summary,
  lastUpdateDialogShownAt,
  onConfirm,
}: {
  dialog: ReturnType<typeof useInTabDialog>;
  themeVariant: 'light' | 'dark';
  intl: IntlShape;
  summary: string;
  lastUpdateDialogShownAt?: number;
  onConfirm: () => void;
}) => {
  const now = Date.now();
  if (
    lastUpdateDialogShownAt &&
    now - lastUpdateDialogShownAt < UPDATE_DIALOG_INTERVAL
  ) {
    return;
  }
  void backgroundApiProxy.serviceAppUpdate.updateLastDialogShownAt();

  dialog.show({
    dismissOnOverlayPress: false,
    renderIcon: <LottieViewIcon themeVariant={themeVariant} />,
    title: intl.formatMessage({
      id: ETranslations.update_notification_dialog_title,
    }),
    description:
      summary ||
      intl.formatMessage({
        id: ETranslations.update_notification_dialog_desc,
      }),
    onConfirmText: intl.formatMessage({
      id: ETranslations.update_update_now,
    }),
    showCancelButton: false,
    onHeaderCloseButtonPress: () => {
      defaultLogger.app.component.closedInUpdateDialog();
    },
    onConfirm,
  });
};
