import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { getDisplayEmailOrUnknown } from '@onekeyhq/kit/src/components/OneKeyAuth/oneKeyIdDisplayEmailUtils';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { LayoutHeaderLanguageSelector } from '@onekeyhq/kit/src/views/Onboardingv2/components/Layout';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type ETabHomeRoutes as ETabHomeRoutesType,
  type ITabHomeParamList,
} from '@onekeyhq/shared/src/routes';

import { showOneKeyIdLoginFailedToast } from '../../components/oneKeyIdLoginToastUtils';
import {
  PrimeRedemptionFormView,
  PrimeRedemptionSuccessView,
} from '../../components/PrimeRedemptionViews';
import { usePrimeRedemptionSubmit } from '../../hooks/usePrimeRedemptionSubmit';
import { PrimeTestIDs } from '../../testIDs';

function getStringQueryParam(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string');
  }
  return undefined;
}

function goToWebHome() {
  if (typeof globalThis.location !== 'undefined') {
    globalThis.location.href = '/';
  }
}

function Header() {
  return (
    <XStack h={52} px="$5" ai="center" jc="space-between">
      <Stack
        aria-label="OneKey home"
        onPress={goToWebHome}
        hoverStyle={{ opacity: 0.7 }}
        pressStyle={{ opacity: 0.5 }}
      >
        <Icon name="OnekeyTextIllus" color="$text" h={28} w={102} />
      </Stack>
      <LayoutHeaderLanguageSelector />
    </XStack>
  );
}

function PrimeRedeemLoginPrompt({
  isLoginLoading,
  onLogin,
}: {
  isLoginLoading: boolean;
  onLogin: () => void;
}) {
  const intl = useIntl();
  return (
    <YStack w="100%" maxWidth={360} gap="$4" alignItems="center">
      <SizableText
        size="$headingXl"
        textAlign="center"
        $gtMd={{ size: '$heading2xl' }}
      >
        {intl.formatMessage({
          id: ETranslations.prime_not_logged_in_title,
        })}
      </SizableText>
      <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
        {intl.formatMessage({
          id: ETranslations.prime_not_logged_in_description,
        })}
      </SizableText>
      <Button
        variant="accent"
        size="medium"
        loading={isLoginLoading}
        testID={PrimeTestIDs.redemptionLoginBtn}
        onPress={onLogin}
      >
        {intl.formatMessage({
          id: ETranslations.sign_in_to_onekey_id__title,
        })}
      </Button>
    </YStack>
  );
}

function PrimeRedeemFormSection({
  displayEmail,
  expectedOneKeyUserId,
  initialCode,
  isPrimeActiveBeforeRedeem,
  onExpiredSession,
}: {
  displayEmail: string | undefined;
  expectedOneKeyUserId: string;
  initialCode: string;
  isPrimeActiveBeforeRedeem: boolean;
  onExpiredSession: () => void | Promise<void>;
}) {
  const intl = useIntl();
  const {
    codeValue,
    form,
    isSubmitting,
    redemptionResult,
    runWithSubmittingLock,
    submitRedemption,
  } = usePrimeRedemptionSubmit({
    expectedOneKeyUserId,
    initialCode,
    isPrimeActiveBeforeRedeem,
  });
  const hasLoggedEntryRef = useRef(false);

  useEffect(() => {
    if (hasLoggedEntryRef.current) {
      return;
    }
    hasLoggedEntryRef.current = true;
    defaultLogger.prime.subscription.primeRedemptionEntryClick({
      isPrimeActiveBeforeRedeem,
    });
  }, [isPrimeActiveBeforeRedeem]);

  if (redemptionResult) {
    return (
      <YStack w="100%" maxWidth={360} testID={PrimeTestIDs.redemptionSuccess}>
        <PrimeRedemptionSuccessView redemptionResult={redemptionResult} />
        <Button
          mt="$5"
          variant="accent"
          testID={PrimeTestIDs.redemptionDoneBtn}
          onPress={goToWebHome}
        >
          {intl.formatMessage({
            id: ETranslations.redemption_done_button,
          })}
        </Button>
      </YStack>
    );
  }

  return (
    <YStack w="100%" maxWidth={360} gap="$5">
      <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
        {getDisplayEmailOrUnknown({
          intl,
          displayEmail,
        })}
      </SizableText>
      <PrimeRedemptionFormView form={form} />
      <Button
        variant="accent"
        testID={PrimeTestIDs.redemptionSubmitBtn}
        disabled={!codeValue?.trim() || isSubmitting}
        loading={isSubmitting}
        onPress={() => {
          void runWithSubmittingLock(() =>
            submitRedemption({
              code: form.getValues('code').trim(),
              onExpiredSession,
            }),
          );
        }}
      >
        {intl.formatMessage({
          id: ETranslations.redemption_redeem_button,
        })}
      </Button>
    </YStack>
  );
}

function PrimeRedeemLandingPage() {
  const route = useAppRoute<
    ITabHomeParamList,
    ETabHomeRoutesType.TabHomePrimeRedeem
  >();
  const intl = useIntl();
  const { isLoggedIn, loginOneKeyId, user } = useOneKeyAuth();
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const isLoginLoadingRef = useRef(false);
  const initialCode = getStringQueryParam(route.params?.code)?.trim() || '';
  const expectedOneKeyUserId = user?.onekeyUserId;

  const handleLogin = useCallback(() => {
    if (isLoginLoadingRef.current) {
      return;
    }
    isLoginLoadingRef.current = true;
    setIsLoginLoading(true);
    void loginOneKeyId()
      .catch((error) => {
        showOneKeyIdLoginFailedToast({ error, intl });
      })
      .finally(() => {
        isLoginLoadingRef.current = false;
        setIsLoginLoading(false);
      });
  }, [intl, loginOneKeyId]);

  useFocusEffect(
    useCallback(() => {
      if (!platformEnv.isWeb) {
        return undefined;
      }
      appEventBus.emit(EAppEventBusNames.HideTabBar, true);
      return () => {
        appEventBus.emit(EAppEventBusNames.HideTabBar, false);
      };
    }, []),
  );

  return (
    <Page>
      <Page.Body>
        <YStack flex={1} testID={PrimeTestIDs.redemptionLandingPage}>
          <Header />
          <YStack
            flex={1}
            w="100%"
            alignItems="center"
            justifyContent="center"
            px="$5"
            py="$10"
            $gtMd={{
              px: '$8',
              py: '$20',
            }}
          >
            {isLoggedIn && expectedOneKeyUserId ? (
              <PrimeRedeemFormSection
                displayEmail={user?.displayEmail}
                expectedOneKeyUserId={expectedOneKeyUserId}
                initialCode={initialCode}
                isPrimeActiveBeforeRedeem={Boolean(
                  user?.primeSubscription?.isActive,
                )}
                onExpiredSession={handleLogin}
              />
            ) : (
              <PrimeRedeemLoginPrompt
                isLoginLoading={isLoginLoading}
                onLogin={handleLogin}
              />
            )}
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export { PrimeRedeemLandingPage };
