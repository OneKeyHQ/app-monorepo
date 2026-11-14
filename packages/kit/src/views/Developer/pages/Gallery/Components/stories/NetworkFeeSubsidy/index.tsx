import { useHeaderHeight } from '@react-navigation/elements';

import { Button, Page, ScrollView, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, ETestModalPages } from '@onekeyhq/shared/src/routes';

export default function NetworkFeeSubsidyGallery() {
  const navigation = useAppNavigation();
  const headerHeight = useHeaderHeight();

  return (
    <Page>
      <Page.Header title="网络费补贴" />
      <Page.Body pt={platformEnv.isNativeIOS26Plus ? headerHeight : 0}>
        <ScrollView>
          <YStack p="$5" gap="$3">
            <Button
              onPress={() => {
                navigation.pushModal(EModalRoutes.TestModal, {
                  screen: ETestModalPages.NetworkFeeSubsidy,
                });
              }}
            >
              网络费补贴
            </Button>
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
