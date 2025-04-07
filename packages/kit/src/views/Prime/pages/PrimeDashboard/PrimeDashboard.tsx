import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  Icon,
  IconButton,
  Page,
  RichSizeableText,
  SizableText,
  Stack,
  Theme,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { useLoginOneKeyId } from '@onekeyhq/kit/src/hooks/useLoginOneKeyId';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';

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
  const intl = useIntl();
  return (
    <RichSizeableText
      size="$bodyMd"
      linkList={{
        link: {
          url: 'https://help.onekey.so/hc/articles/11967482818831',
          color: '$textLink',
          size: '$bodyMd',
        },
      }}
    >
      {intl.formatMessage({
        id: ETranslations.prime_agree_to_terms,
      })}
    </RichSizeableText>
  );
}

export default function PrimeDashboard() {
  const intl = useIntl();
  const { user, isLoggedIn, isPrimeSubscriptionActive, logout } =
    usePrimeAuthV2();
  const { top } = useSafeAreaInsets();
  const { isNative, isWebMobile } = platformEnv;
  const isMobile = isNative || isWebMobile;
  const mobileTopValue = isMobile ? top + 25 : '$10';

  const { loginOneKeyId } = useLoginOneKeyId();

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
    if (!isLoggedIn) {
      await loginOneKeyId();
      return;
    }

    const purchaseDialog = Dialog.show({
      renderContent: (
        <PrimePurchaseDialog
          onPurchase={() => {
            void purchaseDialog.close();
          }}
        />
      ),
    });
  }, [isLoggedIn, loginOneKeyId]);

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

            {platformEnv.isDev ? (
              <PrimeDebugPanel
                shouldShowConfirmButton={shouldShowConfirmButton}
              />
            ) : null}
            <PrimeBenefitsList />
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
              <PrimeTerms />

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
