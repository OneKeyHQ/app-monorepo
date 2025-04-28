import type { IPageScreenProps } from '@onekeyhq/components';
import {
  IconButton,
  Page,
  View,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type {
  EOnboardingPages,
  IOnboardingParamList,
} from '@onekeyhq/shared/src/routes';

import { Actions, TermsAndPrivacy, Welcome } from './components';

export function GetStarted(
  _props: IPageScreenProps<IOnboardingParamList, EOnboardingPages.GetStarted>,
) {
  const { top } = useSafeAreaInsets();

  return (
    <Page safeAreaEnabled>
      <Page.Header headerShown={false} />
      <Page.Body bg="$background">
        <Welcome />

        <Actions />

        <TermsAndPrivacy />

        <View position="absolute" left="$5" top={top || '$5'}>
          <Page.Close>
            <IconButton
              testID="onboarding-exit-button"
              icon="CrossedLargeOutline"
              variant="tertiary"
            />
          </Page.Close>
        </View>
      </Page.Body>
    </Page>
  );
}

export default GetStarted;
