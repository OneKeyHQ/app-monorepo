import { useEffect } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  IconButton,
  Page,
  View,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EOnboardingPages,
  IOnboardingParamList,
} from '@onekeyhq/shared/src/routes';

import { Actions, TermsAndPrivacy, Welcome } from './components';

export function GetStarted({
  route,
}: IPageScreenProps<IOnboardingParamList, EOnboardingPages.GetStarted>) {
  const { isFullModal, fromExt } = route.params || {};
  const { top: topInset } = useSafeAreaInsets();
  let top = isFullModal ? topInset : '$5';

  if (fromExt) {
    top = '$5';
  }

  useEffect(() => {
    return () => {
      defaultLogger.account.wallet.onboardingExit();
    };
  }, []);

  return (
    <Page safeAreaEnabled>
      <Page.Header headerShown={false} />
      <Page.Body bg="$background">
        <Welcome />

        <Actions />

        <TermsAndPrivacy />

        <View position="absolute" left="$5" top={top}>
          <Page.Close>
            <IconButton icon="CrossedLargeOutline" variant="tertiary" />
          </Page.Close>
        </View>
      </Page.Body>
    </Page>
  );
}

export default GetStarted;
