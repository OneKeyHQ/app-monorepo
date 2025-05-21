import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  Icon,
  IconButton,
  Page,
  SizableText,
  Spinner,
  Stack,
  Theme,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { useLoginOneKeyId } from '@onekeyhq/kit/src/hooks/useLoginOneKeyId';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';
import { usePrimeRequirements } from '../../hooks/usePrimeRequirements';

import { PrimeBenefitsList } from './PrimeBenefitsList';
import { PrimeDebugPanel } from './PrimeDebugPanel';
import { PrimeLottieAnimation } from './PrimeLottieAnimation';
import { PrimeUserInfo } from './PrimeUserInfo';

const PrimePurchaseDialog = LazyLoadPage(
  () => import('../../components/PrimePurchaseDialog/PrimePurchaseDialog'),
  100,
  true,
);

function PrimeBanner() {
  const intl = useIntl();

  return (
    <YStack pt="$5" gap="$2" alignItems="center">
      <Icon size="$20" name="OnekeyPrimeDarkColored" />
      <SizableText size="$heading3xl" mt="$-1" textAlign="center">
        OneKey Prime
      </SizableText>
      <SizableText
        size="$bodyLg"
        maxWidth="$96"
        textAlign="center"
        color="$textSubdued"
      >
        {intl.formatMessage({
          id: ETranslations.prime_description,
        })}
      </SizableText>
    </YStack>
  );
}

function PrimeTerms() {
  const linkView = useCallback(
    () => (
      <SizableText
        size="$bodyMd"
        color="$textInteractive"
        cursor="pointer"
        onPress={() => {
          openUrlExternal('https://help.onekey.so/hc/articles/11967482818831');
        }}
      >
        OneKey Prime Terms
      </SizableText>
    ),
    [],
  );
  return (
    <HyperlinkText
      size="$bodyMd"
      values={{
        link: linkView,
      }}
      translationId={ETranslations.prime_agree_to_terms}
      defaultMessage={ETranslations.prime_agree_to_terms}
    />
  );
}

export default function PrimeDashboard() {
  const intl = useIntl();
  // const isReady = false;
  const {
    isReady,
    user,
    isLoggedIn,
    isPrimeSubscriptionActive,
    // logout,
  } = usePrimeAuthV2();
  const { top } = useSafeAreaInsets();
  const { isNative, isWebMobile } = platformEnv;
  const isMobile = isNative || isWebMobile;
  const mobileTopValue = isMobile ? top + 25 : '$10';
  const { ensurePrimeSubscriptionActive } = usePrimeRequirements();

  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  useEffect(() => {
    const fn = async () => {
      // isFocused won't be triggered when Login Dialog is open or closed
      if (isFocused) {
        await timerUtils.wait(600);
        if (!isFocusedRef.current) {
          // may be blurred when auto navigate to Device Limit Page
          return;
        }
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
      }
    };
    void fn();
  }, [isFocused]);

  const shouldShowConfirmButton = useMemo(() => {
    if (!isLoggedIn) {
      return true;
    }
    if (isLoggedIn && !isPrimeSubscriptionActive) {
      return true;
    }
    return false;
  }, [isLoggedIn, isPrimeSubscriptionActive]);

  const subscribe = useCallback(async () => {
    await ensurePrimeSubscriptionActive({
      skipDialogConfirm: true,
    });
  }, [ensurePrimeSubscriptionActive]);

  return (
    <>
      <Theme name="dark">
        <Stack position="absolute" left="$5" top={top || '$5'} zIndex="$5">
          <Page.Close>
            <IconButton icon="CrossedLargeOutline" variant="tertiary" />
          </Page.Close>
        </Stack>
        <Page scrollEnabled>
          <Page.Header headerShown={false} />
          <Page.Body>
            <Stack
              px="$5"
              pt={mobileTopValue}
              pb={isMobile ? '$10' : '$5'}
              gap="$5"
              overflow="hidden"
              borderBottomWidth={StyleSheet.hairlineWidth}
              borderBottomColor="$borderSubdued"
            >
              <PrimeLottieAnimation />
              <PrimeBanner />
              {user?.isLoggedIn ? <PrimeUserInfo /> : null}
            </Stack>

            {isReady ? <PrimeBenefitsList /> : <Spinner my="$10" />}

            {platformEnv.isDev ? (
              <PrimeDebugPanel
                shouldShowConfirmButton={shouldShowConfirmButton}
              />
            ) : null}
          </Page.Body>

          <Page.Footer
            onConfirm={shouldShowConfirmButton ? subscribe : undefined}
            onConfirmText={intl.formatMessage({
              id: ETranslations.prime_subscribe,
            })}
          >
            <Stack
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              gap="$2.5"
              p="$5"
              $md={{
                alignItems: 'flex-start',
                flexDirection: 'column',
              }}
            >
              {shouldShowConfirmButton ? <PrimeTerms /> : null}

              <Page.FooterActions
                p="$0"
                $md={{
                  width: '100%',
                }}
                onConfirm={shouldShowConfirmButton ? subscribe : undefined}
                onConfirmText={intl.formatMessage({
                  id: ETranslations.prime_subscribe,
                })}
              />
            </Stack>
          </Page.Footer>
        </Page>
      </Theme>
    </>
  );
}
