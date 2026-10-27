import { EModalMarketRoutes } from '@onekeyhq/kit/src/views/Market/router/types';
import {
  EAccountManagerStacksRoutes,
  EAssetSelectorRoutes,
  EChainSelectorPages,
  EModalAssetDetailRoutes,
  EModalFiatCryptoRoutes,
  EModalReceiveRoutes,
  EModalRoutes,
  EModalSendRoutes,
  EModalSignatureConfirmRoutes,
  EModalStakingRoutes,
  EModalSwapRoutes,
  EModalWalletAddressRoutes,
  EModalWebViewRoutes,
  EOnboardingPages,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
  ETabDiscoveryRoutes,
  ETabEarnRoutes,
  ETabHomeRoutes,
  ETabMarketRoutes,
  ETabRoutes,
  ETabSwapRoutes,
} from '@onekeyhq/shared/src/routes';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import { EUniversalSearchSource } from '@onekeyhq/shared/types/search';

import {
  accountManagerStacksTable,
  assetSelectorModalTable,
  chainSelectorModalTable,
  classifyReplayRoute,
  earnTabTable,
  fiatCryptoModalTable,
  homeTabTable,
  marketModalTable,
  marketTabTable,
  modalContainerTable,
  onboardingRootContainerTable,
  onboardingV1PageTable,
  onboardingV2PageTable,
  perpPageTable,
  receiveModalTable,
  rootRouteTable,
  sendModalTable,
  signatureConfirmModalTable,
  stakingModalTable,
  swapModalTable,
  swapTabTable,
  tabContainerTable,
  universalSearchModalTable,
  walletAddressModalTable,
} from './replayRouteClassifier';

import type { IReplayNavRoute, IReplayNavState } from './replayRouteClassifier';

// ---------------------------------------------------------------------------
// State builders
// ---------------------------------------------------------------------------

const stack = (...routes: IReplayNavRoute[]): IReplayNavState => ({
  index: routes.length - 1,
  routes,
});

const leaf = (name: string, params?: unknown): IReplayNavRoute => ({
  name,
  params,
});

const container = (
  name: string,
  ...leaves: IReplayNavRoute[]
): IReplayNavRoute => ({
  name,
  state: stack(...leaves),
});

const allTabs = Object.values(ETabRoutes);

// Root `main` with every tab registered and `focused` selected.
const mainRoute = (
  focused: ETabRoutes,
  ...leaves: IReplayNavRoute[]
): IReplayNavRoute => ({
  name: ERootRoutes.Main,
  state: {
    index: allTabs.indexOf(focused),
    routes: allTabs.map((tab) =>
      tab === focused
        ? container(tab, ...leaves)
        : container(tab, leaf('Untouched')),
    ),
  },
});

const modalRoute = (...containers: IReplayNavRoute[]): IReplayNavRoute => ({
  name: ERootRoutes.Modal,
  state: stack(...containers),
});

const fullScreenRoute = (
  ...containers: IReplayNavRoute[]
): IReplayNavRoute => ({
  name: ERootRoutes.iOSFullScreen,
  state: stack(...containers),
});

const onboardingRoute = (...pages: IReplayNavRoute[]): IReplayNavRoute => ({
  name: ERootRoutes.Onboarding,
  state: stack(container(EOnboardingV2Routes.OnboardingV2, ...pages)),
});

const classify = (
  state: IReplayNavState | undefined,
  isDiscoveryEarnSelected = false,
) => classifyReplayRoute({ state, isDiscoveryEarnSelected });

const homeMain = () => mainRoute(ETabRoutes.Home, leaf(ETabHomeRoutes.TabHome));
const swapMain = () => mainRoute(ETabRoutes.Swap, leaf(ETabSwapRoutes.TabSwap));

// ---------------------------------------------------------------------------
// Behavior
// ---------------------------------------------------------------------------

describe('replayRouteClassifier', () => {
  it('denies when there is no navigation state', () => {
    const decision = classify(undefined);
    expect(decision.allowed).toBe(false);
    expect(decision.routeKey).toBeUndefined();
  });

  it('denies unknown routes by default', () => {
    expect(classify(stack(leaf('SomethingNew'))).allowed).toBe(false);
    expect(
      classify(stack(homeMain(), modalRoute(container('NewModal', leaf('X')))))
        .allowed,
    ).toBe(false);
    expect(
      classify(
        stack(
          homeMain(),
          modalRoute(container(EModalRoutes.SwapModal, leaf('NewSwapPage'))),
        ),
      ).allowed,
    ).toBe(false);
    expect(
      classify(stack(mainRoute(ETabRoutes.Market, leaf('NewMarketPage'))))
        .allowed,
    ).toBe(false);
  });

  it('records the in-scope tabs and denies Home', () => {
    expect(
      classify(stack(mainRoute(ETabRoutes.Market, leaf('TabMarket')))).allowed,
    ).toBe(true);
    expect(classify(stack(swapMain())).allowed).toBe(true);
    expect(
      classify(stack(mainRoute(ETabRoutes.Perp, leaf(ETabRoutes.Perp))))
        .allowed,
    ).toBe(true);
    expect(
      classify(stack(mainRoute(ETabRoutes.Earn, leaf(ETabEarnRoutes.EarnHome))))
        .allowed,
    ).toBe(true);
    expect(classify(stack(homeMain())).allowed).toBe(false);
    expect(
      classify(
        stack(
          mainRoute(ETabRoutes.Home, leaf(ETabHomeRoutes.TabHomeDustSweep)),
        ),
      ).allowed,
    ).toBe(true);
  });

  it('reports a route key made of root, container and leaf', () => {
    const decision = classify(
      stack(
        mainRoute(
          ETabRoutes.Market,
          leaf(ETabMarketRoutes.TabMarket),
          leaf(ETabMarketRoutes.MarketDetailV2, { tokenAddress: '0xabc' }),
        ),
      ),
    );
    expect(decision.allowed).toBe(true);
    expect(decision.routeKey).toBe('main/Market/MarketDetailV2');
    // Params never show up in the key.
    expect(decision.routeKey).not.toContain('0xabc');
  });

  it('only classifies the focused tab', () => {
    const state = stack({
      name: ERootRoutes.Main,
      state: {
        index: 1,
        routes: [
          container(ETabRoutes.Market, leaf(ETabMarketRoutes.TabMarket)),
          container(ETabRoutes.Home, leaf(ETabHomeRoutes.TabHome)),
        ],
      },
    });
    expect(classify(state).allowed).toBe(false);
  });

  describe('leaf-name collisions', () => {
    it('TxConfirm: SignatureConfirm inherits, ApprovalManagement denies', () => {
      expect(
        classify(
          stack(
            swapMain(),
            modalRoute(
              container(
                EModalRoutes.SignatureConfirmModal,
                leaf(EModalSignatureConfirmRoutes.TxConfirm),
              ),
            ),
          ),
        ).allowed,
      ).toBe(true);
      expect(
        classify(
          stack(
            swapMain(),
            modalRoute(
              container(
                EModalRoutes.ApprovalManagementModal,
                leaf(EModalApprovalManagementRoutes.TxConfirm),
              ),
            ),
          ),
        ).allowed,
      ).toBe(false);
    });

    it('Buy: FiatCrypto and Receive are both in scope, ReceiveToken is not', () => {
      expect(
        classify(
          stack(
            homeMain(),
            modalRoute(
              container(
                EModalRoutes.FiatCryptoModal,
                leaf(EModalFiatCryptoRoutes.BuyModal),
              ),
            ),
          ),
        ).allowed,
      ).toBe(true);
      expect(
        classify(
          stack(
            homeMain(),
            modalRoute(
              container(
                EModalRoutes.ReceiveModal,
                leaf(EModalReceiveRoutes.BuyModal),
              ),
            ),
          ),
        ).allowed,
      ).toBe(true);
      expect(
        classify(
          stack(
            homeMain(),
            modalRoute(
              container(
                EModalRoutes.ReceiveModal,
                leaf(EModalReceiveRoutes.ReceiveToken),
              ),
            ),
          ),
        ).allowed,
      ).toBe(false);
    });

    it('DeriveTypesAddress follows the page below it inside Receive', () => {
      expect(
        classify(
          stack(
            homeMain(),
            modalRoute(
              container(
                EModalRoutes.ReceiveModal,
                leaf(EModalReceiveRoutes.BuyModal),
                leaf(EModalReceiveRoutes.DeriveTypesAddress),
              ),
            ),
          ),
        ).allowed,
      ).toBe(true);
      expect(
        classify(
          stack(
            homeMain(),
            modalRoute(
              container(
                EModalRoutes.ReceiveModal,
                leaf(EModalReceiveRoutes.ReceiveToken),
                leaf(EModalReceiveRoutes.DeriveTypesAddress),
              ),
            ),
          ),
        ).allowed,
      ).toBe(false);
    });

    it('MarketDetail: Market tab records, MainModal market records, wallet search does not', () => {
      expect(
        classify(
          stack(
            mainRoute(ETabRoutes.Market, leaf(ETabMarketRoutes.MarketDetail)),
          ),
        ).allowed,
      ).toBe(true);
      expect(
        classify(
          stack(
            homeMain(),
            modalRoute(
              container(
                EModalRoutes.MainModal,
                leaf(EModalAssetDetailRoutes.TokenDetails),
                leaf(EModalAssetDetailRoutes.MarketDetail),
              ),
            ),
          ),
        ).allowed,
      ).toBe(true);
      expect(
        classify(
          stack(
            homeMain(),
            modalRoute(
              container(
                EModalRoutes.UniversalSearchModal,
                leaf(EUniversalSearchPages.UniversalSearch, {
                  source: EUniversalSearchSource.Wallet,
                }),
                leaf(EUniversalSearchPages.MarketDetail),
              ),
            ),
          ),
        ).allowed,
      ).toBe(false);
    });

    it('MobileTokenSelector is in scope under both PerpModal and MarketModal', () => {
      expect(
        classify(
          stack(
            homeMain(),
            modalRoute(
              container(
                EModalRoutes.PerpModal,
                leaf(EModalPerpRoutes.MobileTokenSelector),
              ),
            ),
          ),
        ).allowed,
      ).toBe(true);
      expect(
        classify(
          stack(
            homeMain(),
            modalRoute(
              container(
                EModalRoutes.MarketModal,
                leaf(EModalMarketRoutes.MobileTokenSelector),
              ),
            ),
          ),
        ).allowed,
      ).toBe(true);
    });

    it('MainModal only records its DeFi and Market pages', () => {
      const mainModal = (page: string) =>
        classify(
          stack(
            homeMain(),
            modalRoute(container(EModalRoutes.MainModal, leaf(page))),
          ),
        ).allowed;
      expect(mainModal(EModalAssetDetailRoutes.DeFiProtocolDetails)).toBe(true);
      expect(mainModal(EModalAssetDetailRoutes.DeFiProtocolAction)).toBe(true);
      expect(mainModal(EModalAssetDetailRoutes.MarketChart)).toBe(true);
      expect(mainModal(EModalAssetDetailRoutes.TokenDetails)).toBe(false);
      expect(mainModal(EModalAssetDetailRoutes.HistoryDetails)).toBe(false);
    });
  });

  describe('modal vs iOSFullScreen', () => {
    it('classifies both root modal kinds the same way', () => {
      const cases: [IReplayNavRoute, boolean][] = [
        [
          container(
            EModalRoutes.PerpModal,
            leaf(EModalPerpRoutes.MobileTokenSelector),
          ),
          true,
        ],
        [
          container(
            EModalRoutes.PerpModal,
            leaf(EModalPerpRoutes.PerpsInviteeRewardModal),
          ),
          false,
        ],
        [
          container(
            EModalRoutes.WebViewModal,
            leaf(EModalWebViewRoutes.WebView),
          ),
          false,
        ],
        [
          container(
            EModalRoutes.SignatureConfirmModal,
            leaf(EModalSignatureConfirmRoutes.TxConfirmFromSwap),
          ),
          true,
        ],
      ];
      for (const [c, expected] of cases) {
        const viaModal = classify(stack(swapMain(), modalRoute(c)));
        const viaFullScreen = classify(stack(swapMain(), fullScreenRoute(c)));
        expect(viaModal.allowed).toBe(expected);
        expect(viaFullScreen.allowed).toBe(expected);
        expect(viaFullScreen.routeClass).toBe(viaModal.routeClass);
      }
    });
  });

  describe('INHERIT', () => {
    const txConfirm = () =>
      modalRoute(
        container(
          EModalRoutes.SignatureConfirmModal,
          leaf(EModalSignatureConfirmRoutes.TxConfirm),
        ),
      );

    it('records TxConfirm over Swap and denies it over Home', () => {
      const overSwap = classify(stack(swapMain(), txConfirm()));
      expect(overSwap.allowed).toBe(true);
      expect(overSwap.decidingKey).toBe('main/Swap/TabSwap');
      expect(overSwap.routeKey).toBe(
        'modal/SignatureConfirmModal/TxConfirm (via main/Swap/TabSwap)',
      );
      const overHome = classify(stack(homeMain(), txConfirm()));
      expect(overHome.allowed).toBe(false);
      expect(overHome.routeClass).toBe('outOfScope');
    });

    it('records MessageConfirm over an Earn staking modal', () => {
      expect(
        classify(
          stack(
            homeMain(),
            modalRoute(
              container(
                EModalRoutes.StakingModal,
                leaf(EModalStakingRoutes.ManagePosition),
              ),
            ),
            modalRoute(
              container(
                EModalRoutes.SignatureConfirmModal,
                leaf(EModalSignatureConfirmRoutes.MessageConfirm),
              ),
            ),
          ),
        ).allowed,
      ).toBe(true);
    });

    it('records TxConfirm over the Earn tab and denies it over Send', () => {
      expect(
        classify(
          stack(
            mainRoute(
              ETabRoutes.Earn,
              leaf(ETabEarnRoutes.EarnHome),
              leaf(ETabEarnRoutes.EarnProtocolDetails),
            ),
            txConfirm(),
          ),
        ).allowed,
      ).toBe(true);
      expect(
        classify(
          stack(
            homeMain(),
            modalRoute(
              container(
                EModalRoutes.SendModal,
                leaf(EModalSendRoutes.SendDataInput),
              ),
            ),
            txConfirm(),
          ),
        ).allowed,
      ).toBe(false);
    });

    it('walks the inner modal stack before the root stack', () => {
      // One root modal holding two EModalRoutes: Swap below Market selectors.
      expect(
        classify(
          stack(
            homeMain(),
            modalRoute(
              container(
                EModalRoutes.SwapModal,
                leaf(EModalSwapRoutes.SwapMainLand),
              ),
              container(
                EModalRoutes.ChainSelectorModal,
                leaf(EChainSelectorPages.ChainSelector),
              ),
              container(
                EModalRoutes.AssetSelectorModal,
                leaf(EAssetSelectorRoutes.TokenSelector),
              ),
            ),
          ),
        ).allowed,
      ).toBe(true);
      // Same shape over an in-scope tab but an out-of-scope inner modal.
      expect(
        classify(
          stack(
            swapMain(),
            modalRoute(
              container(
                EModalRoutes.AddressBookModal,
                leaf('AddressBookListModal'),
              ),
              container(
                EModalRoutes.AssetSelectorModal,
                leaf(EAssetSelectorRoutes.TokenSelector),
              ),
            ),
          ),
        ).allowed,
      ).toBe(false);
    });

    it('denies a third-party page stacked in the same root modal', () => {
      const decision = classify(
        stack(
          swapMain(),
          modalRoute(
            container(
              EModalRoutes.SwapModal,
              leaf(EModalSwapRoutes.SwapMainLand),
            ),
            container(
              EModalRoutes.WebViewModal,
              leaf(EModalWebViewRoutes.WebView),
            ),
          ),
        ),
      );
      expect(decision.allowed).toBe(false);
      expect(decision.routeClass).toBe('thirdParty');
    });

    it('records HeadlessBuy stacked over a token detail in one root modal', () => {
      expect(
        classify(
          stack(
            homeMain(),
            modalRoute(
              container(
                EModalRoutes.MainModal,
                leaf(EModalAssetDetailRoutes.TokenDetails),
              ),
              container(
                EModalRoutes.FiatCryptoModal,
                leaf(EModalFiatCryptoRoutes.HeadlessBuy),
              ),
            ),
          ),
        ).allowed,
      ).toBe(true);
    });

    it('records WalletAddress and SendConfirmFromSwap only above Swap', () => {
      for (const c of [
        container(
          EModalRoutes.WalletAddress,
          leaf(EModalWalletAddressRoutes.WalletAddress),
        ),
        container(
          EModalRoutes.SendModal,
          leaf(EModalSendRoutes.SendConfirmFromSwap),
        ),
      ]) {
        expect(classify(stack(swapMain(), modalRoute(c))).allowed).toBe(true);
        expect(classify(stack(homeMain(), modalRoute(c))).allowed).toBe(false);
      }
    });

    it('denies an inherit page with nothing below it', () => {
      expect(classify(stack(txConfirm())).allowed).toBe(false);
    });

    it('records the native fullscreen chart only over a chart page', () => {
      const fullscreen = leaf(ERootRoutes.TradingViewNativeFullscreen);
      expect(
        classify(
          stack(
            mainRoute(ETabRoutes.Market, leaf(ETabMarketRoutes.MarketDetailV2)),
            fullscreen,
          ),
        ).allowed,
      ).toBe(true);
      expect(classify(stack(homeMain(), fullscreen)).allowed).toBe(false);
    });
  });

  describe('third-party routes', () => {
    it('denies WebViewModal, RootWebView and DApp confirms over Swap', () => {
      const overSwap = (top: IReplayNavRoute) =>
        classify(stack(swapMain(), top)).allowed;
      expect(
        overSwap(
          modalRoute(
            container(
              EModalRoutes.WebViewModal,
              leaf(EModalWebViewRoutes.WebView),
            ),
          ),
        ),
      ).toBe(false);
      expect(
        overSwap({
          name: ERootRoutes.WebView,
          state: stack(container('WebView', leaf('WebView'))),
        }),
      ).toBe(false);
      for (const page of [
        EModalSignatureConfirmRoutes.TxConfirmFromDApp,
        EModalSignatureConfirmRoutes.MessageConfirmFromDApp,
        EModalSignatureConfirmRoutes.BatchTxConfirmFromDApp,
      ]) {
        expect(
          overSwap(
            modalRoute(
              container(EModalRoutes.SignatureConfirmModal, leaf(page)),
            ),
          ),
        ).toBe(false);
      }
      expect(
        overSwap(
          modalRoute(
            container(
              EModalRoutes.SendModal,
              leaf(EModalSendRoutes.SendConfirmFromDApp),
            ),
          ),
        ),
      ).toBe(false);
      expect(
        overSwap(
          modalRoute(
            container(
              EModalRoutes.DAppConnectionModal,
              leaf('ConnectionModal'),
            ),
          ),
        ),
      ).toBe(false);
    });

    it('denies the Hyperliquid web tab and the desktop browser tab', () => {
      expect(
        classify(
          stack(
            mainRoute(
              ETabRoutes.WebviewPerpTrade,
              leaf(ETabRoutes.WebviewPerpTrade),
            ),
          ),
        ).allowed,
      ).toBe(false);
      expect(
        classify(stack(mainRoute(ETabRoutes.MultiTabBrowser, leaf('Browser'))))
          .allowed,
      ).toBe(false);
    });
  });

  describe('native Discovery tab', () => {
    const discovery = (...leaves: IReplayNavRoute[]) =>
      stack(mainRoute(ETabRoutes.Discovery, ...leaves));

    it('records the Earn sub-tab and denies the DApp browser', () => {
      const home = discovery(leaf(ETabDiscoveryRoutes.TabDiscovery));
      expect(classify(home, true).allowed).toBe(true);
      const browser = classify(home, false);
      expect(browser.allowed).toBe(false);
      expect(browser.routeClass).toBe('thirdParty');
    });

    it('records Earn pages and Market redirects in the Discovery stack', () => {
      for (const page of [
        ETabEarnRoutes.EarnProtocolDetails,
        ETabEarnRoutes.BorrowReserveDetails,
        ETabEarnRoutes.EarnPositions,
        ETabMarketRoutes.MarketDetailV2,
      ]) {
        expect(
          classify(
            discovery(leaf(ETabDiscoveryRoutes.TabDiscovery), leaf(page)),
            false,
          ).allowed,
        ).toBe(true);
      }
    });
  });

  describe('Market search', () => {
    const search = (source: EUniversalSearchSource) =>
      stack(
        mainRoute(ETabRoutes.Market, leaf(ETabMarketRoutes.TabMarket)),
        modalRoute(
          container(
            EModalRoutes.UniversalSearchModal,
            leaf(EUniversalSearchPages.UniversalSearch, { source }),
          ),
        ),
      );

    it('records only searches opened from Market', () => {
      expect(classify(search(EUniversalSearchSource.Market)).allowed).toBe(
        true,
      );
      expect(classify(search(EUniversalSearchSource.Wallet)).allowed).toBe(
        false,
      );
      expect(classify(search(EUniversalSearchSource.Browser)).allowed).toBe(
        false,
      );
    });
  });

  describe('onboarding', () => {
    it('records safe pages and denies sensitive ones', () => {
      expect(
        classify(
          stack(
            homeMain(),
            onboardingRoute(
              leaf(EOnboardingPagesV2.GetStarted),
              leaf(EOnboardingPagesV2.PickYourDevice),
              leaf(EOnboardingPagesV2.ConnectYourDevice),
            ),
          ),
        ).allowed,
      ).toBe(true);
      const phrase = classify(
        stack(
          homeMain(),
          onboardingRoute(
            leaf(EOnboardingPagesV2.GetStarted),
            leaf(EOnboardingPagesV2.ShowRecoveryPhrase),
          ),
        ),
      );
      expect(phrase.allowed).toBe(false);
      expect(phrase.routeClass).toBe('sensitive');
    });

    it('keeps a safe page paused while a sensitive page sits below it', () => {
      const decision = classify(
        stack(
          homeMain(),
          onboardingRoute(
            leaf(EOnboardingPagesV2.GetStarted),
            leaf(EOnboardingPagesV2.ShowRecoveryPhrase),
            leaf(EOnboardingPagesV2.VerifyRecoveryPhrase),
            leaf(EOnboardingPagesV2.FinalizeWalletSetup),
          ),
        ),
      );
      expect(decision.allowed).toBe(false);
      expect(decision.routeClass).toBe('safe');
      expect(decision.sensitiveKey).toBe(
        'onboarding/OnboardingV2/VerifyRecoveryPhrase',
      );
    });

    it('denies a sensitive modal anywhere in the root stack', () => {
      expect(
        classify(
          stack(
            swapMain(),
            modalRoute(container(EModalRoutes.ManualBackupModal, leaf('X'))),
            modalRoute(
              container(
                EModalRoutes.SwapModal,
                leaf(EModalSwapRoutes.SwapMainLand),
              ),
            ),
          ),
        ).allowed,
      ).toBe(false);
    });

    it('treats v1 onboarding pages explicitly', () => {
      const v1 = (page: EOnboardingPages) =>
        classify(
          stack(
            homeMain(),
            modalRoute(container(EModalRoutes.OnboardingModal, leaf(page))),
          ),
        ).allowed;
      expect(v1(EOnboardingPages.ConnectYourDevice)).toBe(true);
      expect(v1(EOnboardingPages.ImportRecoveryPhrase)).toBe(false);
      expect(v1(EOnboardingPages.ConnectWalletOptions)).toBe(false);
    });

    it('denies onboarding pages reached through external wallets and OAuth', () => {
      for (const page of [
        EOnboardingPagesV2.ConnectExternalWallet,
        EOnboardingPagesV2.ConnectWalletSelectNetworks,
        EOnboardingPagesV2.OneKeyIDLogin,
      ]) {
        expect(
          classify(stack(homeMain(), onboardingRoute(leaf(page)))).allowed,
        ).toBe(false);
      }
    });
  });

  describe('not-yet-mounted nested navigators', () => {
    it('follows params.screen', () => {
      const state = stack(homeMain(), {
        name: ERootRoutes.Modal,
        params: {
          screen: EModalRoutes.SwapModal,
          params: { screen: EModalSwapRoutes.SwapMainLand },
        },
      });
      const decision = classify(state);
      expect(decision.allowed).toBe(true);
      expect(decision.routeKey).toBe('modal/SwapModal/SwapMainLand');
    });

    it('denies a table container whose leaf is still unknown', () => {
      const state = stack(homeMain(), {
        name: ERootRoutes.Modal,
        params: { screen: EModalRoutes.SwapModal },
      });
      expect(classify(state).allowed).toBe(false);
    });

    it('denies a tab whose stack has not mounted', () => {
      const state = stack({
        name: ERootRoutes.Main,
        state: { index: 0, routes: [{ name: ETabRoutes.Market }] },
      });
      expect(classify(state).allowed).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Exhaustiveness: adding a member to any of these enums fails here until it
// is classified on purpose.
// ---------------------------------------------------------------------------

describe('replayRouteClassifier exhaustiveness', () => {
  const expectClassified = (
    enumObject: Record<string, string>,
    table: Readonly<Record<string, unknown>>,
  ) => {
    const missing = Object.values(enumObject).filter(
      (value) => !Object.prototype.hasOwnProperty.call(table, value),
    );
    expect(missing).toEqual([]);
  };

  it.each([
    ['ERootRoutes', ERootRoutes, rootRouteTable],
    ['ETabRoutes', ETabRoutes, tabContainerTable],
    ['EModalRoutes', EModalRoutes, modalContainerTable],
    ['EOnboardingV2Routes', EOnboardingV2Routes, onboardingRootContainerTable],
    ['EOnboardingPagesV2', EOnboardingPagesV2, onboardingV2PageTable],
    ['EOnboardingPages', EOnboardingPages, onboardingV1PageTable],
    ['ETabMarketRoutes', ETabMarketRoutes, marketTabTable],
    ['ETabSwapRoutes', ETabSwapRoutes, swapTabTable],
    ['ETabEarnRoutes', ETabEarnRoutes, earnTabTable],
    ['ETabHomeRoutes', ETabHomeRoutes, homeTabTable],
    ['EModalPerpRoutes', EModalPerpRoutes, perpPageTable],
    ['EModalSwapRoutes', EModalSwapRoutes, swapModalTable],
    ['EModalMarketRoutes', EModalMarketRoutes, marketModalTable],
    ['EModalStakingRoutes', EModalStakingRoutes, stakingModalTable],
    ['EModalFiatCryptoRoutes', EModalFiatCryptoRoutes, fiatCryptoModalTable],
    ['EModalReceiveRoutes', EModalReceiveRoutes, receiveModalTable],
    [
      'EModalSignatureConfirmRoutes',
      EModalSignatureConfirmRoutes,
      signatureConfirmModalTable,
    ],
    ['EModalSendRoutes', EModalSendRoutes, sendModalTable],
    ['EAssetSelectorRoutes', EAssetSelectorRoutes, assetSelectorModalTable],
    ['EChainSelectorPages', EChainSelectorPages, chainSelectorModalTable],
    [
      'EModalWalletAddressRoutes',
      EModalWalletAddressRoutes,
      walletAddressModalTable,
    ],
    ['EUniversalSearchPages', EUniversalSearchPages, universalSearchModalTable],
    [
      'EAccountManagerStacksRoutes',
      EAccountManagerStacksRoutes,
      accountManagerStacksTable,
    ],
  ] as [string, Record<string, string>, Readonly<Record<string, unknown>>][])(
    'classifies every member of %s',
    (_name, enumObject, table) => {
      expectClassified(enumObject, table);
    },
  );

  it('classifies every MainModal asset detail page', () => {
    const mainModalTable = modalContainerTable[EModalRoutes.MainModal];
    expect(typeof mainModalTable).toBe('object');
    expectClassified(
      EModalAssetDetailRoutes,
      mainModalTable as Readonly<Record<string, unknown>>,
    );
  });

  it('keeps PerpModal and the Perp tab pages in sync', () => {
    const perpTab = tabContainerTable[ETabRoutes.Perp] as Readonly<
      Record<string, unknown>
    >;
    expectClassified(EModalPerpRoutes, perpTab);
    expect(modalContainerTable[EModalRoutes.PerpModal]).toBe(perpPageTable);
  });

  it('keeps Discovery in sync with the Earn tab pages', () => {
    const discoveryTab = tabContainerTable[ETabRoutes.Discovery] as Readonly<
      Record<string, unknown>
    >;
    expectClassified(ETabEarnRoutes, discoveryTab);
    expectClassified(ETabDiscoveryRoutes, discoveryTab);
  });
});
