import { useState } from 'react';

import {
  Button,
  Checkbox,
  Dialog,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

// Same OneKey user service agreement used across the app (see
// hyperliquid perp.constants TERMS_OF_SERVICE_URL)
const ONEKEY_TERMS_OF_USE_URL =
  'https://help.onekey.so/articles/11461297-user-service-agreement';

// FIXME: Replace with product-approved i18n keys once available
// (OK-59196: "i18n 稍后同步过来"). Copy mirrors figma 27404-41361.
const RISK_WARNING_COPY = {
  title: 'Risk Warning',
  bullets: [
    'OneKey DeFi includes multiple DeFi products operated independently by third parties, and OneKey only provides access without participating in their operation.',
    'DeFi products are high-risk and may involve smart contract vulnerabilities, hacking incidents, and potential asset loss.',
    'OneKey is not responsible for any losses caused by third-party products and does not provide compensation.',
  ],
  checkboxPrefix: 'I understand the above risks, agree to the OneKey ',
  termsLink: 'Terms of Use',
  checkboxSuffix:
    ', and confirm that I will do my own research (DYOR).',
  cancel: 'Cancel',
  confirm: 'Confirm',
} as const;

function EarnRiskWarningContent({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <YStack gap="$4">
      <YStack gap="$2.5">
        {RISK_WARNING_COPY.bullets.map((bullet) => (
          <XStack key={bullet.slice(0, 24)} gap="$2" ai="flex-start">
            <SizableText size="$bodyMd" color="$textSubdued">
              •
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
              {bullet}
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
          {RISK_WARNING_COPY.checkboxPrefix}
          <SizableText
            size="$bodyMd"
            color="$textInfo"
            textDecorationLine="underline"
            onPress={() => {
              openUrlExternal(ONEKEY_TERMS_OF_USE_URL);
            }}
          >
            {RISK_WARNING_COPY.termsLink}
          </SizableText>
          {RISK_WARNING_COPY.checkboxSuffix}
        </SizableText>
      </XStack>
      <XStack gap="$2.5" pt="$1">
        <Button flex={1} size="large" variant="secondary" onPress={onCancel}>
          {RISK_WARNING_COPY.cancel}
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
          {RISK_WARNING_COPY.confirm}
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
}: {
  provider: string;
  symbol: string;
  networkId?: string;
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
      title: RISK_WARNING_COPY.title,
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
