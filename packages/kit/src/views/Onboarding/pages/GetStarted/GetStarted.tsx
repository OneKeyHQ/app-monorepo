import { useEffect, useState } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  IconButton,
  Page,
  View,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EOnboardingPages,
  IOnboardingParamList,
} from '@onekeyhq/shared/src/routes';

import { Actions, TermsAndPrivacy, Welcome } from './components';

export function GetStarted({
  route,
}: IPageScreenProps<IOnboardingParamList, EOnboardingPages.GetStarted>) {
  const { isFullModal } = route.params || {};
  const { top: safeAreaTop } = useSafeAreaInsets();
  let top: number | string = '$5';

  if (isFullModal && platformEnv.isNative) {
    top = safeAreaTop;
  }

  useEffect(() => {
    return () => {
      defaultLogger.account.wallet.onboardingExit();
    };
  }, []);

  const [showTransfer, setShowTransfer] = useState(false);

  return (
    <Page safeAreaEnabled>
      <Page.Header headerShown={false} />
      <Page.Body bg="$background">
        <Welcome setShowTransfer={setShowTransfer} />

        <Actions showTransfer={showTransfer} />

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
