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
  ActionList,
  Button,
  Icon,
  Page,
  SizableText,
  Stack,
  Theme,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { getDisplayEmailOrUnknown } from '@onekeyhq/kit/src/components/OneKeyAuth/oneKeyIdDisplayEmailUtils';
import { useConfirmOneKeyIdLogout } from '@onekeyhq/kit/src/components/OneKeyAuth/useConfirmOneKeyIdLogout';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { LayoutHeaderLanguageSelector } from '@onekeyhq/kit/src/views/Onboardingv2/components/Layout';
import { DOWNLOAD_URL } from '@onekeyhq/shared/src/config/appConfig';
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
import {
  getBoundOAuthProviders,
  getOneKeyIdOAuthProviderIcon,
  getOneKeyIdOAuthProviderName,
} from '@onekeyhq/shared/src/utils/oauthProviderUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IOneKeyIdAccount } from '@onekeyhq/shared/types/prime/primeTypes';

import { showOneKeyIdLoginFailedToast } from '../../components/oneKeyIdLoginToastUtils';
import {
  PrimeRedemptionFormView,
  PrimeRedemptionSuccessView,
} from '../../components/PrimeRedemptionViews';
import { usePrimeRedemptionSubmit } from '../../hooks/usePrimeRedemptionSubmit';
import { PrimeTestIDs } from '../../testIDs';
import { PRIME_FEATURE_INTROS } from '../PrimeFeatures/primeFeatureIntroUtils';

const LANDING_ACTION_BUTTON = {
  variant: 'accent' as const,
  width: '100%' as const,
  size: 'large' as const,
  $gtMd: { size: 'medium' as const },
};

function RedeemLandingAction({ children }: { children: ReactNode }) {
  const { gtMd } = useMedia();
  const { bottom } = useSafeAreaInsets();

  if (gtMd) {
    return children;
  }

  return (
    <Page.Footer>
      <YStack
        bg="$bgApp"
        px="$4"
        py="$4"
        alignItems="center"
        paddingBottom={16 + (platformEnv.isNative ? 0 : bottom)}
      >
        <YStack width="100%" maxWidth={360}>
          {children}
        </YStack>
      </YStack>
    </Page.Footer>
  );
}

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
    <YStack w="100%" gap="$5" testID={testID}>
      {children}
    </YStack>
  );
}

function maskRedeemLandingEmail(displayEmail: string | undefined) {
  if (!displayEmail) {
    return undefined;
  }
  const separatorIndex = displayEmail.indexOf('@');
  if (separatorIndex <= 0) {
    return displayEmail;
  }
  return `${displayEmail.slice(0, 1)}***${displayEmail.slice(separatorIndex)}`;
}

function openOneKeyDownload() {
  openUrlUtils.openUrlExternal(DOWNLOAD_URL);
}

function RedeemLandingBenefitsPanel({
  showDownload,
}: {
  showDownload: boolean;
}) {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);
  const features = PRIME_FEATURE_INTROS.filter(
    (feature) => !feature.isComingSoon,
  );

  return (
    <YStack
      w="100%"
      borderWidth="$px"
      borderColor="$borderSubdued"
      borderRadius="$3"
      overflow="hidden"
    >
      <Button
        testID={PrimeTestIDs.redemptionBenefitsToggle}
        variant="tertiary"
        size="medium"
        height="auto"
        width="100%"
        mx={0}
        my={0}
        borderWidth={0}
        borderRadius={0}
        px="$3.5"
        py="$3"
        justifyContent="space-between"
        aria-expanded={expanded}
        accessibilityLabel={`OneKey Prime · ${intl.formatMessage({
          id: expanded
            ? ETranslations.global_show_less
            : ETranslations.global_show_more,
        })}`}
        iconAfter={
          expanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
        }
        onPress={() => setExpanded((current) => !current)}
      >
        OneKey Prime
      </Button>
      {expanded ? (
        <YStack
          gap="$3"
          p="$3.5"
          borderTopWidth="$px"
          borderTopColor="$borderSubdued"
        >
          {features.map((feature) => (
            <XStack key={feature.id} gap="$3" alignItems="flex-start">
              <Icon name={feature.listIcon} size="$5" color="$iconSubdued" />
              <SizableText size="$bodyMd" flex={1} minWidth={0}>
                {intl.formatMessage({ id: feature.title })}
              </SizableText>
            </XStack>
          ))}
        </YStack>
      ) : null}
      {showDownload ? (
        <YStack borderTopWidth="$px" borderTopColor="$borderSubdued">
          <Button
            testID={PrimeTestIDs.redemptionDownloadBtn}
            variant="tertiary"
            size="medium"
            height="auto"
            width="100%"
            mx={0}
            my={0}
            childrenAsText={false}
            borderWidth={0}
            borderRadius={0}
            px="$3.5"
            py="$3"
            justifyContent="space-between"
            iconAfter="ArrowTopRightOutline"
            onPress={openOneKeyDownload}
          >
            <YStack flex={1} minWidth={0} gap="$1" alignItems="flex-start">
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({
                  id: ETranslations.global_download_onekey_wallet,
                })}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                iOS / Android / macOS / Windows / Linux
              </SizableText>
            </YStack>
          </Button>
        </YStack>
      ) : null}
    </YStack>
  );
}

function RedeemLandingLayout({
  children,
  showDownload = true,
}: {
  children: ReactNode;
  showDownload?: boolean;
}) {
  return (
    <YStack
      w="100%"
      maxWidth={360}
      gap="$6"
      alignItems="center"
      $gtMd={{ maxWidth: 320 }}
    >
      {children}
      <RedeemLandingBenefitsPanel showDownload={showDownload} />
    </YStack>
  );
}

function RedeemLandingEmailChip({
  disabled,
  displayEmail,
  onekeyAccount,
  onLogout,
}: {
  disabled?: boolean;
  displayEmail: string | undefined;
  onekeyAccount: IOneKeyIdAccount | undefined;
  onLogout: () => void;
}) {
  const intl = useIntl();
  const oauthProviders = getBoundOAuthProviders(onekeyAccount);
  const displayEmailLabel = getDisplayEmailOrUnknown({
    displayEmail,
    intl,
  });
  const oauthProviderNames = oauthProviders.map(getOneKeyIdOAuthProviderName);
  const renderItems = useCallback(
    ({ handleActionListClose }: { handleActionListClose: () => void }) => (
      <ActionList.Item
        icon="LogoutOutline"
        label={intl.formatMessage({ id: ETranslations.prime_log_out })}
        onClose={handleActionListClose}
        onPress={onLogout}
      />
    ),
    [intl, onLogout],
  );

  return (
    <ActionList
      title="OneKey ID"
      placement="bottom"
      disabled={disabled}
      floatingPanelProps={{ w: '$64' }}
      renderItems={renderItems}
      renderTrigger={
        <XStack
          testID={PrimeTestIDs.redemptionAccountChip}
          render="button"
          onPress={() => undefined}
          role="button"
          tabIndex={disabled ? -1 : 0}
          cursor={disabled ? 'default' : 'pointer'}
          opacity={disabled ? 0.5 : 1}
          maxWidth="100%"
          alignItems="center"
          gap="$1.5"
          px="$2.5"
          py="$1.5"
          bg="$bgSubdued"
          borderWidth="$px"
          borderColor="$borderSubdued"
          borderRadius="$full"
          hoverStyle={disabled ? undefined : { opacity: 0.8 }}
          pressStyle={disabled ? undefined : { opacity: 0.6 }}
          focusable={!disabled}
          accessibilityLabel={
            oauthProviderNames.length
              ? `${oauthProviderNames.join(' · ')} · ${displayEmailLabel}`
              : displayEmailLabel
          }
        >
          {oauthProviders.length === 0 ? (
            <Icon name="PeopleOutline" size="$4" color="$iconSubdued" />
          ) : (
            oauthProviders.map((provider) => (
              <Icon
                key={provider}
                name={getOneKeyIdOAuthProviderIcon(provider)}
                size="$4"
                color="$icon"
              />
            ))
          )}
          <SizableText
            size="$bodySmMedium"
            color="$text"
            numberOfLines={1}
            ellipsizeMode="middle"
            flexShrink={1}
          >
            {displayEmailLabel}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        </XStack>
      }
    />
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

function PrimeRedeemFormSection({
  canRedeem,
  displayEmail,
  expectedOneKeyUserId,
  initialCode,
  isLoginLoading,
  isPrimeActiveBeforeRedeem,
  onekeyAccount,
  onLogin,
}: {
  canRedeem: boolean;
  displayEmail: string | undefined;
  expectedOneKeyUserId: string | undefined;
  initialCode: string;
  isLoginLoading: boolean;
  isPrimeActiveBeforeRedeem: boolean;
  onekeyAccount: IOneKeyIdAccount | undefined;
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
  const handleLogoutSuccess = useCallback(() => {
    form.clearErrors('code');
  }, [form]);
  const handleLogout = useConfirmOneKeyIdLogout({
    reason: 'PrimeRedeemLanding Logout Button',
    onSuccess: handleLogoutSuccess,
  });
  const lastLoggedPrimeActiveRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    if (redemptionResult) {
      return;
    }
    if (lastLoggedPrimeActiveRef.current === isPrimeActiveBeforeRedeem) {
      return;
    }
    lastLoggedPrimeActiveRef.current = isPrimeActiveBeforeRedeem;
    defaultLogger.prime.subscription.primeRedemptionEntryClick({
      isPrimeActiveBeforeRedeem,
    });
  }, [isPrimeActiveBeforeRedeem, redemptionResult]);

  const maskedEmail = maskRedeemLandingEmail(displayEmail);

  if (redemptionResult) {
    return (
      <RedeemLandingLayout showDownload={false}>
        <RedeemLandingContent testID={PrimeTestIDs.redemptionSuccess}>
          <PrimeRedemptionSuccessView redemptionResult={redemptionResult} />
          <YStack gap="$1.5" width="100%">
            {maskedEmail ? (
              <SizableText size="$bodyMd" textAlign="center">
                {maskedEmail}
              </SizableText>
            ) : null}
            <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.prime_onekeyid_continue_description,
              })}
            </SizableText>
          </YStack>
          <RedeemLandingAction>
            <Button
              {...LANDING_ACTION_BUTTON}
              testID={PrimeTestIDs.redemptionDownloadBtn}
              onPress={openOneKeyDownload}
            >
              {intl.formatMessage({
                id: ETranslations.global_download_onekey_wallet,
              })}
            </Button>
          </RedeemLandingAction>
        </RedeemLandingContent>
      </RedeemLandingLayout>
    );
  }

  return (
    <RedeemLandingLayout>
      <RedeemLandingContent>
        <PrimeRedemptionFormView
          form={form}
          accountSlot={
            canRedeem ? (
              <RedeemLandingEmailChip
                disabled={isSubmitting}
                displayEmail={displayEmail}
                onekeyAccount={onekeyAccount}
                onLogout={handleLogout}
              />
            ) : undefined
          }
        />
        <RedeemLandingAction>
          <Button
            {...LANDING_ACTION_BUTTON}
            testID={
              canRedeem
                ? PrimeTestIDs.redemptionSubmitBtn
                : PrimeTestIDs.redemptionLoginBtn
            }
            disabled={
              canRedeem ? !codeValue?.trim() || isSubmitting : undefined
            }
            loading={canRedeem ? isSubmitting : isLoginLoading}
            onPress={() => {
              if (!canRedeem) {
                onLogin();
                return;
              }
              void runWithSubmittingLock(() =>
                submitRedemption({ onExpiredSession: onLogin }),
              );
            }}
          >
            {intl.formatMessage({
              id: canRedeem
                ? ETranslations.redemption_redeem_button
                : ETranslations.sign_in_to_onekey_id__title,
            })}
          </Button>
        </RedeemLandingAction>
      </RedeemLandingContent>
    </RedeemLandingLayout>
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
              justifyContent="flex-start"
              px="$4"
              pt="$8"
              pb="$8"
              $gtMd={{
                px: '$8',
                pt: '$20',
                pb: '$20',
              }}
              testID={PrimeTestIDs.redemptionLandingBody}
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
                onekeyAccount={user?.onekeyAccount}
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
