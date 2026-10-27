import { EAccountManagerStacksRoutes } from '../../routes/accountManagerStacks';
import { EModalRoutes } from '../../routes/modal';
import { EOnboardingPages } from '../../routes/onboarding';
import { EOnboardingPagesV2 } from '../../routes/onboardingv2';
import { EModalWebViewRoutes } from '../../routes/webView';

import {
  REPLAY_SENSITIVE_MODAL_NAMES,
  REPLAY_SENSITIVE_ROUTE_NAMES,
  REPLAY_THIRD_PARTY_WEBVIEW_ROUTE_NAMES,
  isReplayBlockedRouteName,
  isReplaySensitiveScreen,
} from './replaySensitiveRoutes';

describe('replaySensitiveRoutes', () => {
  it('covers screens that show or accept secrets', () => {
    [
      EOnboardingPagesV2.ShowRecoveryPhrase,
      EOnboardingPagesV2.VerifyRecoveryPhrase,
      EOnboardingPagesV2.ImportPhraseOrPrivateKey,
      EOnboardingPagesV2.CreatePasscode,
      EOnboardingPagesV2.VerifyPin,
      EOnboardingPages.RecoveryPhrase,
      EOnboardingPages.ImportPrivateKey,
      EAccountManagerStacksRoutes.ExportPrivateKeysPage,
    ].forEach((routeName) => {
      expect(isReplayBlockedRouteName(routeName)).toBe(true);
    });
  });

  it('covers third-party web views', () => {
    expect(isReplayBlockedRouteName(EModalWebViewRoutes.WebView)).toBe(true);
    expect(
      isReplaySensitiveScreen({
        routeName: 'AnyPage',
        navigatorName: EModalRoutes.WebViewModal,
      }),
    ).toBe(true);
  });

  it('blocks every screen of a sensitive root modal', () => {
    expect(
      isReplaySensitiveScreen({
        routeName: 'ManualBackupSelectWallet',
        navigatorName: EModalRoutes.ManualBackupModal,
      }),
    ).toBe(true);
    expect(
      isReplaySensitiveScreen({
        routeName: 'SomeLeaf',
        navigatorName: EModalRoutes.KeyTagModal,
      }),
    ).toBe(true);
  });

  it('leaves in-scope flows alone', () => {
    [
      EOnboardingPagesV2.GetStarted,
      EOnboardingPagesV2.CreateOrImportWallet,
      EOnboardingPagesV2.FinalizeWalletSetup,
    ].forEach((routeName) => {
      expect(
        isReplaySensitiveScreen({
          routeName,
          navigatorName: 'OnboardingV2',
        }),
      ).toBe(false);
    });
    expect(
      isReplaySensitiveScreen({
        routeName: 'SwapMainLand',
        navigatorName: EModalRoutes.SwapModal,
      }),
    ).toBe(false);
    expect(isReplaySensitiveScreen({ routeName: 'MarketDetail' })).toBe(false);
  });

  it('only contains non-empty route names', () => {
    [
      ...REPLAY_SENSITIVE_ROUTE_NAMES,
      ...REPLAY_THIRD_PARTY_WEBVIEW_ROUTE_NAMES,
      ...REPLAY_SENSITIVE_MODAL_NAMES,
    ].forEach((name) => {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });
});
