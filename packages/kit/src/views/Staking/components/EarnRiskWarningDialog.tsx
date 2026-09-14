import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Dialog,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type { FormatXMLElementFn } from 'intl-messageformat';

// Same OneKey user service agreement used across the app (see
// hyperliquid perp.constants TERMS_OF_SERVICE_URL)
const ONEKEY_TERMS_OF_USE_URL =
  'https://help.onekey.so/articles/11461297-user-service-agreement';

const RISK_WARNING_BULLET_IDS = [
  ETranslations.onekey_defi_third_party_operation__desc,
  ETranslations.defi_product_risk_warning__desc,
  ETranslations.onekey_defi_third_party_loss_disclaimer__desc,
] as const;

function EarnRiskWarningContent({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const intl = useIntl();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // react-intl ships a different React type version here; match the rich-text
  // callback typing already used by the shared terms controls.
  const renderTermsTag: FormatXMLElementFn<string, any> = useCallback(
    (chunks: string[]) => (
      <SizableText
        size="$bodyMd"
        color="$textInfo"
        textDecorationLine="underline"
        onPress={() => {
          openUrlExternal(ONEKEY_TERMS_OF_USE_URL);
        }}
      >
        {chunks}
      </SizableText>
    ),
    [],
  );

  return (
    <YStack gap="$4">
      <YStack gap="$2.5">
        {RISK_WARNING_BULLET_IDS.map((messageId) => (
          <XStack key={messageId} gap="$2" ai="flex-start">
            <SizableText size="$bodyMd" color="$textSubdued">
              •
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
              {intl.formatMessage({ id: messageId })}
            </SizableText>
          </XStack>
        ))}
      </YStack>
      {/* The Checkbox label prop is plain text only, so the rich label (with
          the Terms of Use link) sits next to a bare checkbox; the whole row
          toggles, while the link handles its own press */}
      <XStack
        gap="$3"
        ai="flex-start"
        onPress={() => setAgreed(!agreed)}
        userSelect="none"
      >
        <Checkbox
          testID="earn-risk-warning-checkbox"
          value={agreed}
          onChange={(value) => setAgreed(Boolean(value))}
        />
        <SizableText size="$bodyMd" flex={1}>
          {intl.formatMessage(
            { id: ETranslations.defi_risk_acknowledgement__desc },
            { termsTag: renderTermsTag },
          )}
        </SizableText>
      </XStack>
      <XStack gap="$2.5" pt="$1">
        <Button
          testID="earn-risk-warning-cancel"
          flex={1}
          size="large"
          variant="secondary"
          onPress={onCancel}
        >
          {intl.formatMessage({ id: ETranslations.global_cancel })}
        </Button>
        <Button
          testID="earn-risk-warning-confirm"
          flex={1}
          size="large"
          variant="primary"
          disabled={!agreed || submitting}
          loading={submitting}
          onPress={async () => {
            setSubmitting(true);
            try {
              await onConfirm();
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {intl.formatMessage({ id: ETranslations.global_confirm })}
        </Button>
      </XStack>
    </YStack>
  );
}

// One-time earn risk disclaimer before the first earn trade (OK-59196).
// Mirrors the perp Hyperliquid terms flow: the accepted flag lives in local
// simpleDb, so once confirmed the dialog never shows again on this device.
// Resolves true when the user may proceed with the trade.
export async function showEarnRiskWarningDialog({
  provider,
  symbol,
  networkId,
  title,
}: {
  provider: string;
  symbol: string;
  networkId?: string;
  title: string;
}): Promise<boolean> {
  const isAccepted =
    await backgroundApiProxy.simpleDb.earnExtra.getRiskDisclaimerAccepted();
  if (isAccepted) {
    return true;
  }

  return new Promise((resolve) => {
    let didConfirm = false;
    let hasResolved = false;
    let didTrackReject = false;
    const safeResolve = (value: boolean) => {
      if (!hasResolved) {
        hasResolved = true;
        resolve(value);
      }
    };
    const trackReject = () => {
      if (!didConfirm && !didTrackReject) {
        didTrackReject = true;
        defaultLogger.staking.page.earnRiskDisclaimerReject({
          stakingProtocol: provider,
          tokenSymbol: symbol,
          networkId,
        });
      }
    };

    const dialog = Dialog.show({
      title,
      renderContent: (
        <EarnRiskWarningContent
          onConfirm={async () => {
            defaultLogger.staking.page.earnRiskDisclaimerAgree({
              stakingProtocol: provider,
              tokenSymbol: symbol,
              networkId,
            });
            await backgroundApiProxy.simpleDb.earnExtra.setRiskDisclaimerAccepted(
              true,
            );
            didConfirm = true;
            await dialog.close();
            safeResolve(true);
          }}
          onCancel={() => {
            void dialog.close();
          }}
        />
      ),
      showExitButton: true,
      disableDrag: true,
      dismissOnOverlayPress: false,
      showFooter: false,
      showCancelButton: false,
      showConfirmButton: false,
      contentContainerProps: platformEnv.isNative
        ? { px: '$3', pb: '$3' }
        : undefined,
      onClose: () => {
        if (!didConfirm) {
          trackReject();
          safeResolve(false);
        }
      },
    });
  });
}

/**
 * Hook form of {@link showEarnRiskWarningDialog} for the trade hooks: it owns
 * the localized title so every gate stays worded the same, and resolves true
 * when the user may proceed (immediately so, once accepted on this device).
 */
export function useEarnRiskWarningGate() {
  const intl = useIntl();
  return useCallback(
    ({
      provider,
      symbol,
      networkId,
    }: {
      provider: string;
      symbol?: string;
      networkId?: string;
    }) =>
      showEarnRiskWarningDialog({
        provider,
        symbol: symbol ?? '',
        networkId,
        title: intl.formatMessage({ id: ETranslations.global_warning }),
      }),
    [intl],
  );
}
