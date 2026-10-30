import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';

import { ActionList, Dialog } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { createPrimeCheckoutHandoff } from '../purchasesSdk/primeCheckoutHandoff';

import { isPrimeWebCheckoutUserCurrent } from './primeWebCheckout';

import type { IWebViewProps } from '../../../components/WebView';
import type { IWebViewRef } from '../../../components/WebView/types';
import type { IntlShape } from 'react-intl';

export function usePrimeWebViewCheckoutMenu({
  enabled,
  routeKey,
  primeUserId,
  intl,
}: {
  enabled: boolean;
  routeKey: string;
  primeUserId?: string;
  intl: IntlShape;
}) {
  const [, update] = useState(0);
  const navigation = useNavigation();
  const instanceRef = useRef<IWebViewRef | null>(null);
  const confirmationRef = useRef<ReturnType<typeof Dialog.show> | undefined>(
    undefined,
  );
  const { checkoutId } = useMemo(
    () => ({ routeKey, primeUserId, checkoutId: generateUUID() }),
    [routeKey, primeUserId],
  );
  const handoff = useMemo(
    () => createPrimeCheckoutHandoff(checkoutId, () => update((n) => n + 1)),
    [checkoutId],
  );
  const invalidate = useCallback(() => {
    handoff.invalidate();
    void confirmationRef.current?.close();
  }, [handoff]);
  useEffect(() => {
    if (!enabled) return;
    return navigation.addListener('beforeRemove', invalidate);
  }, [enabled, navigation, invalidate]);
  useEffect(
    () => () => {
      invalidate();
      instanceRef.current = null;
    },
    [invalidate],
  );
  const onInstanceRef = useCallback((ref: IWebViewRef | null) => {
    instanceRef.current = ref;
  }, []);
  const onLoadStart = useCallback<NonNullable<IWebViewProps['onLoadStart']>>(
    (event) => {
      if (event.nativeEvent.loading && handoff.hasAttempt()) invalidate();
    },
    [handoff, invalidate],
  );
  const headerRight = useCallback(
    () => (
      <ActionList
        title={intl.formatMessage({ id: ETranslations.explore_options })}
        renderTrigger={
          <HeaderIconButton
            icon="DotHorOutline"
            testID="prime-checkout-menu"
            accessibilityLabel={intl.formatMessage({
              id: ETranslations.explore_options,
            })}
          />
        }
        sections={[
          {
            items: [
              {
                label: intl.formatMessage({
                  id: ETranslations.explore_open_in_browser,
                }),
                icon: 'GlobusOutline',
                testID: 'prime-checkout-open-browser',
                disabled: !handoff.canSwitch(),
                onPress: () => {
                  const requestId = generateUUID();
                  if (
                    !enabled ||
                    !instanceRef.current ||
                    !handoff.beginConfirmation(requestId)
                  )
                    return;
                  confirmationRef.current = Dialog.show({
                    title: intl.formatMessage({
                      id: ETranslations.explore_open_in_browser,
                    }),
                    description: intl.formatMessage({
                      id: ETranslations.prime_external_wallet_checkout__desc,
                    }),
                    testID: 'prime-checkout-browser-confirmation',
                    showFooter: true,
                    showCancelButton: true,
                    showConfirmButton: true,
                    onConfirmText: intl.formatMessage({
                      id: ETranslations.global_continue,
                    }),
                    onClose: () => {
                      confirmationRef.current = undefined;
                      handoff.dismissConfirmation(requestId);
                    },
                    onConfirm: async ({ close }) => {
                      if (
                        !primeUserId ||
                        !(await isPrimeWebCheckoutUserCurrent(primeUserId))
                      ) {
                        invalidate();
                        await close();
                        return;
                      }
                      // Consume before close() dismisses the confirmation, then let
                      // the web session recheck submission after the dialog closes.
                      const message = handoff.confirm(requestId);
                      await close();
                      if (message)
                        instanceRef.current?.sendMessageViaInjectedScript(
                          message,
                        );
                    },
                  });
                },
              },
            ],
          },
        ]}
      />
    ),
    [enabled, handoff, intl, invalidate, primeUserId],
  );
  return {
    checkoutId,
    handoff,
    headerRight,
    onInstanceRef,
    onLoadStart,
    invalidate,
  };
}
