import { useIntl } from 'react-intl';

import {
  Page,
  SizableText,
  Stack,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import { HandleRebuildBrowserData } from '../../components/HandleData/HandleRebuildBrowserTabData';
import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import DashboardContent from './DashboardContent';

function HistoryButton() {
  const navigation = useAppNavigation();

  return (
    <HeaderIconButton
      icon="ClockTimeHistoryOutline"
      onPress={() => {
        navigation.pushModal(EModalRoutes.DiscoveryModal, {
          screen: EDiscoveryModalRoutes.HistoryListModal,
        });
      }}
    />
  );
}

const HeaderLeft = () => {
  const intl = useIntl();

  return (
    <SizableText size="$headingLg" color="$text">
      {intl.formatMessage({ id: ETranslations.global_browser })}
    </SizableText>
  );
};

function Dashboard() {
  const { top } = useSafeAreaInsets();

  return (
    <Page>
      <Page.Header headerLeft={HeaderLeft} headerRight={HistoryButton} />
      {platformEnv.isNativeIOSPad ? <HandleRebuildBrowserData /> : null}
      {platformEnv.isNativeIOS ? (
        <XStack px="$5" pt={top} justifyContent="space-between">
          <Stack flex={1} pl="$5" alignItems="center">
            <HeaderLeft />
          </Stack>

          <HistoryButton />
        </XStack>
      ) : null}
      <Page.Body>
        <DashboardContent />
        {platformEnv.isNativeIOSPad ? <MobileBrowserBottomBar id="" /> : null}
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(Dashboard);
