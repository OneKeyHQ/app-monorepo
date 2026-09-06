import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  Page,
  SizableText,
  Stack,
  Theme,
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

const LANDING_ACTION_BUTTON = {
  variant: 'accent' as const,
  width: '100%' as const,
  size: 'large' as const,
  $gtMd: { size: 'medium' as const },
};

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

function RedeemLandingContent({
  children,
  testID,
}: {
  children: ReactNode;
  testID?: string;
}) {
  return (
    <YStack
      w="100%"
      maxWidth={360}
      gap="$5"
      $gtMd={{
        maxWidth: 320,
      }}
      testID={testID}
    >
      {children}
    </YStack>
  );
}

function RedeemLandingEmailChip({
  displayEmail,
}: {
  displayEmail: string | undefined;
}) {
  const intl = useIntl();
  return (
    <XStack
      alignSelf="center"
      maxWidth="100%"
      alignItems="center"
      gap="$1.5"
      px="$2.5"
      py="$1.5"
      bg="$bgSubdued"
      borderWidth="$px"
      borderColor="$borderSubdued"
      borderRadius="$full"
    >
      <Icon name="PeopleOutline" size="$4" color="$iconSubdued" />
      <SizableText
        size="$bodySmMedium"
        color="$text"
        numberOfLines={1}
        ellipsizeMode="middle"
        flexShrink={1}
      >
        {getDisplayEmailOrUnknown({
          intl,
          displayEmail,
        })}
      </SizableText>
    </XStack>
  );
}

function Header() {
  return (
    <XStack
      h={52}
      px="$5"
      ai="center"
      jc="space-between"
      $gtMd={{
        px: '$8',
      }}
    >
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

function PrimeRedeemLandingCta({
  canRedeem,
  codeValue,
  isLoginLoading,
  isSubmitting,
  onLogin,
  onRedeem,
}: {
  canRedeem: boolean;
  codeValue: string | undefined;
  isLoginLoading: boolean;
  isSubmitting: boolean;
  onLogin: () => void;
  onRedeem: () => void;
}) {
  const intl = useIntl();
  if (!canRedeem) {
    return (
      <Button
        {...LANDING_ACTION_BUTTON}
        loading={isLoginLoading}
        testID={PrimeTestIDs.redemptionLoginBtn}
        onPress={onLogin}
      >
        {intl.formatMessage({
          id: ETranslations.sign_in_to_onekey_id__title,
        })}
      </Button>
    );
  }

  return (
    <Button
      {...LANDING_ACTION_BUTTON}
      testID={PrimeTestIDs.redemptionSubmitBtn}
      disabled={!codeValue?.trim() || isSubmitting}
      loading={isSubmitting}
      onPress={onRedeem}
    >
      {intl.formatMessage({
        id: ETranslations.redemption_redeem_button,
      })}
    </Button>
  );
}

function PrimeRedeemFormSection({
  canRedeem,
  displayEmail,
  expectedOneKeyUserId,
  initialCode,
  isLoginLoading,
  isPrimeActiveBeforeRedeem,
  onLogin,
}: {
  canRedeem: boolean;
  displayEmail: string | undefined;
  expectedOneKeyUserId: string | undefined;
  initialCode: string;
  isLoginLoading: boolean;
  isPrimeActiveBeforeRedeem: boolean;
  onLogin: () => void;
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
      <RedeemLandingContent testID={PrimeTestIDs.redemptionSuccess}>
        <PrimeRedemptionSuccessView redemptionResult={redemptionResult} />
        <Button
          {...LANDING_ACTION_BUTTON}
          testID={PrimeTestIDs.redemptionDoneBtn}
          onPress={goToWebHome}
        >
          {intl.formatMessage({
            id: ETranslations.redemption_done_button,
          })}
        </Button>
      </RedeemLandingContent>
    );
  }

  return (
    <RedeemLandingContent>
      {canRedeem ? (
        <RedeemLandingEmailChip displayEmail={displayEmail} />
      ) : null}
      <PrimeRedemptionFormView form={form} />
      <PrimeRedeemLandingCta
        canRedeem={canRedeem}
        codeValue={codeValue}
        isLoginLoading={isLoginLoading}
        isSubmitting={isSubmitting}
        onLogin={onLogin}
        onRedeem={() => {
          void runWithSubmittingLock(() =>
            submitRedemption({
              code: form.getValues('code').trim(),
              onExpiredSession: onLogin,
            }),
          );
        }}
      />
    </RedeemLandingContent>
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
    <Theme name="dark">
      <Page
        scrollEnabled
        scrollProps={{
          keyboardShouldPersistTaps: 'handled',
          contentContainerStyle: {
            flexGrow: 1,
          },
        }}
      >
        <Page.Body>
          <YStack
            flex={1}
            minHeight="100%"
            bg="$bgApp"
            testID={PrimeTestIDs.redemptionLandingPage}
          >
            <Header />
            <YStack
              flex={1}
              w="100%"
              alignItems="center"
              justifyContent="center"
              px="$4"
              py="$8"
              $gtMd={{
                px: '$8',
                py: '$20',
              }}
            >
              <PrimeRedeemFormSection
                canRedeem={Boolean(isLoggedIn && expectedOneKeyUserId)}
                displayEmail={user?.displayEmail}
                expectedOneKeyUserId={expectedOneKeyUserId}
                initialCode={initialCode}
                isLoginLoading={isLoginLoading}
                isPrimeActiveBeforeRedeem={Boolean(
                  user?.primeSubscription?.isActive,
                )}
                onLogin={handleLogin}
              />
            </YStack>
          </YStack>
        </Page.Body>
      </Page>
    </Theme>
  );
}

export { PrimeRedeemLandingPage };
