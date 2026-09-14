import { useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { useDeviceFlickerTrace } from '../debugDeviceFlicker';

import type { ParamListBase } from '@react-navigation/native';

export function useDeviceFlickerNavigation(name: string) {
  const navigation = useNavigation<IPageNavigationProp<ParamListBase>>();
  const { trace } = useDeviceFlickerTrace(name);

  useEffect(() => {
    trace('navigation-attached', { focused: navigation.isFocused() });
    const cleanup = [
      navigation.addListener('focus', () => trace('focus')),
      navigation.addListener('blur', () => trace('blur')),
      navigation.addListener('beforeRemove', () => trace('before-remove')),
      navigation.addListener('transitionStart', ({ data }) =>
        trace('transition-start', { closing: data.closing }),
      ),
      navigation.addListener('transitionEnd', ({ data }) =>
        trace('transition-end', { closing: data.closing }),
      ),
    ];
    const events = [
      EAppEventBusNames.WalletUpdate,
      EAppEventBusNames.HardwareDeviceStateUpdate,
      EAppEventBusNames.HardwareFeaturesUpdate,
      EAppEventBusNames.FinishFirmwareUpdate,
      EAppEventBusNames.FirmwareUpdateDetectStatusChanged,
    ] as const;
    for (const event of events) {
      const handler = () => trace('app-event', { eventName: event });
      appEventBus.on(event, handler);
      cleanup.push(() => appEventBus.off(event, handler));
    }
    return () => cleanup.forEach((unsubscribe) => unsubscribe());
  }, [navigation, trace]);
}
