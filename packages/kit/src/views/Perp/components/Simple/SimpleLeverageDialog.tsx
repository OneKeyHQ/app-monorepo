import { useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsSimplePendingLeverageAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../PerpDialogLayout';
import { TradingGuardWrapper } from '../TradingGuardWrapper';

import { LeverageRuler } from './LeverageRuler';

import type { IntlShape } from 'react-intl';

type ISettings = {
  scope: string;
  coin: string;
  accountAddress: IHex;
  assetId: number;
  leverage: number;
  mode: 'cross' | 'isolated';
  maxLeverage: number;
  onlyIsolated: boolean;
  awaitingConfirmation: boolean;
};

function SimpleLeverageContent({ settings }: { settings: ISettings }) {
  const intl = useIntl();
  const [value, setValue] = useState(settings.leverage);
  const [mode, setMode] = useState(
    settings.onlyIsolated ? 'isolated' : settings.mode,
  );
  const [, setPendingLeverage] = usePerpsSimplePendingLeverageAtom();
  const [loading, setLoading] = useState(false);
  const lock = useRef(false);
  const [account] = usePerpsActiveAccountAtom();
  const [asset] = usePerpsActiveAssetAtom();
  const [data] = usePerpsActiveAssetDataAtom();
  const actions = useHyperliquidActions();
  const dialog = useDialogInstance();
  const current =
    account.accountAddress?.toLowerCase() ===
      settings.accountAddress.toLowerCase() &&
    asset.coin === settings.coin &&
    asset.assetId === settings.assetId &&
    data?.coin === settings.coin &&
    data?.accountAddress?.toLowerCase() ===
      settings.accountAddress.toLowerCase();
  const disabled = loading || !current;
  const confirm = async () => {
    if (disabled || lock.current) return;
    lock.current = true;
    try {
      if (
        !settings.awaitingConfirmation &&
        data?.leverage.value === value &&
        data.leverage.type === mode
      ) {
        await dialog.close();
        return;
      }
      setLoading(true);
      await actions.current.updateLeverage({
        tradingUiMode: 'simple',
        asset: settings.assetId,
        expectedAccountAddress: settings.accountAddress,
        leverage: value,
        isCross: mode === 'cross',
      });
      const pending = {
        value,
        type: mode,
        previousFrame: data,
        previous: [
          { value: settings.leverage, type: settings.mode },
          ...(settings.awaitingConfirmation && data ? [data.leverage] : []),
        ],
      };
      setPendingLeverage((scopes) => ({
        ...scopes,
        [settings.scope]: pending,
      }));
      if (data) {
        void backgroundApiProxy.serviceHyperliquid
          .getActiveAssetDataByCoin({
            coin: settings.coin,
            user: settings.accountAddress,
          })
          .then((snapshot) => {
            if (
              snapshot?.coin !== settings.coin ||
              snapshot.user.toLowerCase() !==
                settings.accountAddress.toLowerCase() ||
              snapshot.leverage.value !== value ||
              snapshot.leverage.type !== mode
            )
              return;
            setPendingLeverage((scopes) =>
              scopes[settings.scope] === pending
                ? {
                    ...scopes,
                    [settings.scope]: {
                      ...pending,
                      refresh: snapshot,
                    },
                  }
                : scopes,
            );
          })
          .catch(() => {
            // The subscription can still provide the confirmed leverage and capacity.
          });
      }
      await dialog.close();
    } catch {
      // The existing action reports exchange errors through its toast handler.
    } finally {
      lock.current = false;
      setLoading(false);
    }
  };
  return (
    <YStack gap="$4">
      <XStack gap="$3" mb="$4">
        {(['cross', 'isolated'] as const).map((option) => (
          <YStack
            key={option}
            testID={`perps-simple-margin-mode-${option}`}
            flex={1}
            minHeight={48}
            px="$4"
            py="$2"
            alignItems="center"
            justifyContent="center"
            borderRadius="$3"
            borderWidth={1}
            borderColor={mode === option ? '$borderActive' : '$borderSubdued'}
            bg="$bg"
            accessibilityRole="radio"
            accessibilityState={{
              checked: mode === option,
              disabled: disabled || settings.onlyIsolated,
            }}
            disabled={disabled || settings.onlyIsolated}
            onPress={() => setMode(option)}
          >
            <SizableText
              size="$bodyMdMedium"
              fontWeight="600"
              color={
                disabled || (settings.onlyIsolated && option === 'cross')
                  ? '$textDisabled'
                  : '$text'
              }
            >
              {intl.formatMessage({
                id:
                  option === 'cross'
                    ? ETranslations.perp_trade_cross
                    : ETranslations.perp_trade_isolated,
              })}
            </SizableText>
          </YStack>
        ))}
      </XStack>
      <XStack alignItems="baseline">
        <YStack flex={1} flexBasis={0} minWidth={0} />
        <SizableText
          size="$heading3xl"
          fontSize={48}
          lineHeight={56}
          fontVariant={['tabular-nums']}
        >
          {value}
        </SizableText>
        <XStack flex={1} flexBasis={0} minWidth={0} alignItems="baseline">
          <SizableText
            size="$headingXl"
            fontSize={24}
            lineHeight={32}
            fontWeight="500"
            color="$textSubdued"
            ml="$1"
          >
            ×
          </SizableText>
        </XStack>
      </XStack>
      <YStack gap="$2" pt="$2">
        <LeverageRuler
          value={value}
          max={settings.maxLeverage}
          disabled={disabled || settings.maxLeverage <= 1}
          accessibilityLabel={intl.formatMessage({
            id: ETranslations.perp_leverage,
          })}
          onChange={setValue}
        />
      </YStack>
      {settings.onlyIsolated ? (
        <XStack gap="$1" alignItems="center">
          <Icon
            name="InfoCircleSolid"
            size="$3.5"
            color="$iconSubdued"
            flexShrink={0}
          />
          <SizableText size="$bodySm" color="$textSubdued" flexShrink={1}>
            {intl.formatMessage({
              id: ETranslations.perp_simple_isolated_only__desc,
            })}
          </SizableText>
        </XStack>
      ) : null}
      <YStack pt="$4">
        <TradingGuardWrapper buttonSize="large">
          <Button
            testID="perps-simple-leverage-confirm"
            variant="primary"
            size="large"
            disabled={disabled}
            loading={loading}
            onPress={confirm}
          >
            {intl.formatMessage({
              id: current
                ? ETranslations.global_confirm
                : ETranslations.perp_simple_reopen_settings__action,
            })}
          </Button>
        </TradingGuardWrapper>
      </YStack>
    </YStack>
  );
}

export function showSimpleLeverageDialog(
  settings: ISettings,
  intl: IntlShape,
  onClose?: () => void,
) {
  return Dialog.show({
    onClose,
    title: intl.formatMessage({ id: ETranslations.perp_leverage }),
    showFooter: false,
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    renderContent: (
      <PerpsAccountSelectorProviderMirror>
        <PerpsProviderMirror>
          <SimpleLeverageContent settings={settings} />
        </PerpsProviderMirror>
      </PerpsAccountSelectorProviderMirror>
    ),
  });
}
