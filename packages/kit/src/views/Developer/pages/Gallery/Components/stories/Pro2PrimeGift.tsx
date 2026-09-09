import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  PrimeGiftClaimContent,
  PrimeGiftSuccessContent,
} from '@onekeyhq/kit/src/views/Prime/components/PrimeGiftViews';
import { usePrimeGiftMessages } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimeGiftMessages';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import type { IPrimeGiftClaimResult } from '@onekeyhq/shared/types/prime/primeGiftTypes';

import { Layout } from './utils/Layout';

type IPreviewState = 'loggedOut' | 'ready' | 'codeReady' | 'error' | 'success';

const PREVIEW_STATES: { value: IPreviewState; label: string }[] = [
  { value: 'loggedOut', label: 'Signed out' },
  { value: 'ready', label: 'Ready to claim' },
  { value: 'codeReady', label: 'Device verified' },
  { value: 'error', label: 'Claim error' },
  { value: 'success', label: 'Success' },
];

const PREVIEW_RESULT: IPrimeGiftClaimResult = {
  serialNo: 'PREVIEW-PRO2',
  giftMonths: 6,
  addedDays: 180,
  finalExpiresAt: Date.UTC(2027, 2, 8),
  onekeyUserId: 'preview-user',
  email: 'preview@example.com',
};

export default function Pro2PrimeGiftGallery() {
  const intl = useIntl();
  const message = usePrimeGiftMessages();
  const [state, setState] = useState<IPreviewState>('loggedOut');
  const [isKytEnabled, setIsKytEnabled] = useState(false);
  const [notificationState, setNotificationState] = useState('Not requested');
  const [enteredWallet, setEnteredWallet] = useState(false);
  const isSuccess = state === 'success';

  const openPreviewKyt = () => {
    Dialog.show({
      icon: 'ShieldCheckDoneOutline',
      title: `Preview: ${intl.formatMessage({
        id: ETranslations.prime_feature_receive_risk_monitoring__title,
      })}`,
      description: 'This preview changes local state only.',
      onConfirmText: intl.formatMessage({
        id: ETranslations.kyt_receive_risk_monitoring_enable__action,
      }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_not_now }),
      onConfirm: async ({ close }) => {
        setIsKytEnabled(true);
        await close();
        Dialog.show({
          icon: 'BellOutline',
          title: 'Preview: Notifications',
          description:
            'No system permission request will run. Skip to keep monitoring enabled.',
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_enable,
          }),
          onCancelText: intl.formatMessage({ id: ETranslations.global_later }),
          onConfirm: () => {
            setNotificationState('Enabled in preview');
          },
          onCancel: () => {
            setNotificationState('Skipped in preview');
          },
        });
      },
    });
  };

  let primaryLabel = message(ETranslationsMock.prime_gift_verify_claim);
  if (state === 'error') {
    primaryLabel = message(ETranslationsMock.prime_gift_retry);
  } else if (state === 'loggedOut') {
    primaryLabel = message(ETranslationsMock.prime_gift_login);
  } else if (state === 'codeReady') {
    primaryLabel = message(ETranslationsMock.prime_gift_claim, {
      count: PREVIEW_RESULT.giftMonths,
    });
  }

  return (
    <Layout componentName="Pro 2 Prime gift · Preview">
      <YStack gap="$4">
        <SizableText color="$textSubdued">
          Shared product components with local preview state. Login, device
          verification, redemption, KYT, and notifications are simulated. This
          is a visual preview, not an end-to-end test.
        </SizableText>
        <XStack flexWrap="wrap" gap="$2">
          {PREVIEW_STATES.map((item) => (
            <Button
              key={item.value}
              size="small"
              variant={state === item.value ? 'primary' : 'secondary'}
              testID={`pro2-prime-preview-state-${item.value}`}
              onPress={() => {
                setState(item.value);
                setEnteredWallet(false);
              }}
            >
              {item.label}
            </Button>
          ))}
          <Button
            size="small"
            variant="tertiary"
            onPress={() => {
              setState('loggedOut');
              setIsKytEnabled(false);
              setNotificationState('Not requested');
              setEnteredWallet(false);
            }}
          >
            Reset preview
          </Button>
        </XStack>
        <YStack
          width={390}
          maxWidth="100%"
          height={640}
          alignSelf="center"
          borderWidth={1}
          borderColor="$borderStrong"
          borderRadius="$6"
          overflow="hidden"
          bg="$bgApp"
          testID="pro2-prime-preview-phone"
        >
          <XStack
            minHeight={56}
            px="$5"
            alignItems="center"
            gap="$3"
            flexShrink={0}
          >
            <Icon name="ChevronLeftOutline" size="$5" />
            <SizableText size="$headingMd" flex={1} textAlign="center">
              {message(ETranslationsMock.prime_gift_title)}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              Preview
            </SizableText>
          </XStack>
          <ScrollView flex={1} contentContainerStyle={{ flexGrow: 1 }}>
            {isSuccess ? (
              <PrimeGiftSuccessContent
                result={PREVIEW_RESULT}
                isKytEnabled={isKytEnabled}
                isKytLoading={false}
                onKyt={openPreviewKyt}
              />
            ) : (
              <PrimeGiftClaimContent
                giftMonths={PREVIEW_RESULT.giftMonths}
                eligibilityStatus={message(
                  ETranslationsMock.prime_gift_eligible,
                )}
                isEligible
                accountName={
                  state === 'loggedOut' ? undefined : PREVIEW_RESULT.email
                }
                isAccountReady={state !== 'loggedOut'}
                isDeviceVerified={state === 'codeReady'}
                isProcessing={false}
                error={
                  state === 'error'
                    ? message(ETranslationsMock.prime_gift_error)
                    : undefined
                }
                onAccount={
                  state === 'loggedOut'
                    ? undefined
                    : () => setState('loggedOut')
                }
              />
            )}
          </ScrollView>
          <YStack px="$5" pt="$3" pb="$5" gap="$3" flexShrink={0}>
            {isSuccess ? null : (
              <>
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  textAlign="center"
                >
                  {message(ETranslationsMock.prime_gift_once)}
                </SizableText>
                <Button
                  size="large"
                  variant="primary"
                  testID="pro2-prime-claim-primary"
                  onPress={() => {
                    setState(
                      state === 'ready' || state === 'codeReady'
                        ? 'success'
                        : 'ready',
                    );
                  }}
                >
                  {primaryLabel}
                </Button>
              </>
            )}
            <Button
              size="large"
              variant={isSuccess ? 'primary' : 'tertiary'}
              testID="pro2-prime-enter-wallet"
              onPress={() => setEnteredWallet(true)}
            >
              {intl.formatMessage({ id: ETranslations.enter_wallet })}
            </Button>
          </YStack>
        </YStack>
        <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
          {`390 × 640 preview · Monitoring: ${isKytEnabled ? 'Enabled' : 'Disabled'} · Notifications: ${notificationState}`}
        </SizableText>
        {enteredWallet ? (
          <SizableText textAlign="center" testID="pro2-prime-preview-wallet">
            Preview: entered wallet
          </SizableText>
        ) : null}
      </YStack>
    </Layout>
  );
}
