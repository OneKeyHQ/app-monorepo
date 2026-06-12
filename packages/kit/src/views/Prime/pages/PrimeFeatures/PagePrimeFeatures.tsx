import { Page, Theme, XStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type {
  EPrimePages,
  IPrimeParamList,
} from '@onekeyhq/shared/src/routes/prime';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { PrimeFeatureIntroContent } from './PrimeFeatureIntroContent';

const PRIME_FEATURE_BACK_BUTTON_BG = '$blackA3';
const primeFeatureBackButtonIconProps = { color: '$whiteA12' } as const;
const primeFeatureBackButtonHoverStyle = { bg: '$blackA4' } as const;
const primeFeatureBackButtonPressStyle = { bg: '$blackA5' } as const;

export default function PagePrimeFeatures() {
  const navigation = useAppNavigation();
  const route = useAppRoute<IPrimeParamList, EPrimePages.PrimeFeatures>();

  return (
    <>
      <Theme name="dark">
        <Page.BackButton
          size="medium"
          bg={PRIME_FEATURE_BACK_BUTTON_BG}
          hoverStyle={primeFeatureBackButtonHoverStyle}
          pressStyle={primeFeatureBackButtonPressStyle}
          iconProps={primeFeatureBackButtonIconProps}
        />
        <Page>
          <Page.Header headerShown={false} />
          <Page.Body>
            <XStack flex={1} overflow="hidden">
              <AccountSelectorProviderMirror
                config={{
                  sceneName: EAccountSelectorSceneName.home,
                }}
                enabledNum={[0]}
              >
                <PrimeFeatureIntroContent
                  selectedFeature={route.params?.selectedFeature}
                  selectedSubscriptionPeriod={
                    route.params?.selectedSubscriptionPeriod
                  }
                  networkId={route.params?.networkId}
                  onClose={() => {
                    navigation.pop();
                  }}
                  mode="page"
                />
              </AccountSelectorProviderMirror>
            </XStack>
          </Page.Body>
        </Page>
      </Theme>
    </>
  );
}
