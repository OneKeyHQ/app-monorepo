import { useEffect, useRef } from 'react';

import { Page, Spinner, Stack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  type ETabHomeRoutes,
  ETabRoutes,
  type ITabHomeParamList,
} from '@onekeyhq/shared/src/routes';

// Map page parameter to tab routes
const PAGE_TO_TAB_ROUTE: Record<string, ETabRoutes> = {
  perp: ETabRoutes.WebviewPerpTrade,
  perps: ETabRoutes.WebviewPerpTrade,
  swap: ETabRoutes.Swap,
  market: ETabRoutes.Market,
  earn: ETabRoutes.Earn,
  defi: ETabRoutes.Earn,
  discover: ETabRoutes.Discovery,
};

function ReferralLandingPage() {
  const route = useAppRoute<
    ITabHomeParamList,
    ETabHomeRoutes.TabHomeReferralLanding
  >();
  const navigation = useAppNavigation();

  const hasProcessedRef = useRef(false);

  const routeParams = route.params as
    | { code: string; page: string }
    | undefined;
  const code = routeParams?.code;
  const page = routeParams?.page;

  useEffect(() => {
    if (hasProcessedRef.current) {
      return;
    }
    hasProcessedRef.current = true;

    const processReferralLanding = async () => {
      // Log the referral landing
      defaultLogger.referral.page.enterReferralGuide(code, 'app_landing');

      // Save referral code to perp DB if page is perp-related
      if (code && (page === 'perp' || page === 'perps')) {
        try {
          await backgroundApiProxy.simpleDb.perp.setPerpData((prev) => ({
            ...prev,
            referralCode: code,
          }));
        } catch (error) {
          console.error('Failed to save referral code to perp DB:', error);
        }
      }

      // Determine target tab route
      const pageLower = page?.toLowerCase() ?? '';
      const targetTabRoute = PAGE_TO_TAB_ROUTE[pageLower] ?? ETabRoutes.Home;

      // Navigate to target page
      navigation.switchTab(targetTabRoute);

      // Open InvitedByFriend modal when user has referral code
      setTimeout(() => {
        navigation.pushModal(EModalRoutes.ReferFriendsModal, {
          screen: EModalReferFriendsRoutes.InvitedByFriend,
          params: {
            code,
            page,
          },
        });
      }, 500);
    };

    void processReferralLanding();
  }, [code, page, navigation]);

  return (
    <Page>
      <Page.Body>
        <YStack flex={1} ai="center" jc="center">
          <Stack>
            <Spinner size="large" />
          </Stack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export { ReferralLandingPage };
