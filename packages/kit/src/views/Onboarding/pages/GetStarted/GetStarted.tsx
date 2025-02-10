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

export function GetStarted({
  route,
}: IPageScreenProps<IOnboardingParamList, EOnboardingPages.GetStarted>) {
  const { top } = useSafeAreaInsets();
  let { showCloseButton } = route.params || {};
  if (process.env.NODE_ENV !== 'production') {
    showCloseButton = true;
  }

  return (
    <Page safeAreaEnabled>
      <Page.Header headerShown={false} />
      <Page.Body>
        <Welcome />

        <Actions />

        <TermsAndPrivacy />

        {showCloseButton ? (
          <View position="absolute" left="$5" top={top || '$5'}>
            <Page.Close>
              <IconButton icon="CrossedLargeOutline" variant="tertiary" />
            </Page.Close>
          </View>
        ) : null}
      </Page.Body>
    </Page>
  );
}

export default GetStarted;
