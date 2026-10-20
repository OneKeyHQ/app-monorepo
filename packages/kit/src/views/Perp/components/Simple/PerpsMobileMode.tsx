import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  useActiveTradeInstrumentAtom,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsSimpleDraftAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  perpsCustomSettingsAtom,
  usePerpsActiveAccountAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { TradingModeOptions } from './TradingModeOptions';

export function useSimpleScope() {
  const [account] = usePerpsActiveAccountAtom();
  const [instrument] = useActiveTradeInstrumentAtom();
  return `${account.accountId ?? account.indexedAccountId ?? ''}:${account.accountAddress?.toLowerCase() ?? ''}:${instrument.coin}`;
}

export function PerpsMobileMode({
  children,
}: {
  children: (mode: 'simple' | 'pro') => ReactNode;
}) {
  const [settings] = usePerpsCustomSettingsAtom();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let active = true;
    void perpsCustomSettingsAtom.ready().then(() => {
      if (active) setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);
  const scope = useSimpleScope();
  const [draft, setDraft] = usePerpsSimpleDraftAtom();
  useEffect(() => {
    if (draft && draft.scope !== scope) void setDraft(undefined);
  }, [draft, scope, setDraft]);
  if (!hydrated)
    return (
      <YStack flex={1} alignItems="center" justifyContent="center">
        <Spinner />
      </YStack>
    );
  const mode = settings.mobileTradingMode ?? 'pro';
  return <YStack flex={1}>{children(mode)}</YStack>;
}

export function PerpsMobileModeSelector() {
  const intl = useIntl();
  const [settings, setSettings] = usePerpsCustomSettingsAtom();
  const [submitting] = useTradingLoadingAtom();
  const disabled = submitting;
  const dialogRef = useRef<ReturnType<typeof Dialog.show> | undefined>(
    undefined,
  );
  const select = useCallback(
    (mode: 'simple' | 'pro') => {
      void dialogRef.current?.close();
      setSettings((prev) =>
        prev.mobileTradingMode === mode
          ? prev
          : { ...prev, mobileTradingMode: mode },
      );
    },
    [setSettings],
  );
  const open = useCallback(() => {
    if (disabled || dialogRef.current) return;
    dialogRef.current = Dialog.show({
      title: intl.formatMessage({ id: ETranslations.perp_simple_mode__title }),
      showFooter: false,
      renderContent: (
        <PerpsProviderMirror>
          <TradingModeOptions onSelect={select} />
        </PerpsProviderMirror>
      ),
      onClose: () => {
        dialogRef.current = undefined;
      },
    });
  }, [disabled, intl, select]);
  return (
    <Button
      testID="perps-mode-switch"
      size="small"
      variant="tertiary"
      px="$1"
      hoverStyle={{ bg: 'transparent' }}
      pressStyle={{ bg: 'transparent' }}
      mx="$0"
      my="$0"
      disabled={disabled}
      childrenAsText={false}
      onPress={open}
    >
      <XStack alignItems="center" gap="$1">
        <SizableText size="$bodyMdMedium" color="$textSubdued">
          {intl.formatMessage({
            id:
              settings.mobileTradingMode === 'simple'
                ? ETranslations.perp_simple_easy__title
                : ETranslations.dexmarket_pro,
          })}
        </SizableText>
        <Icon name="ChevronDownSmallOutline" size="$4.5" color="$iconSubdued" />
      </XStack>
    </Button>
  );
}
