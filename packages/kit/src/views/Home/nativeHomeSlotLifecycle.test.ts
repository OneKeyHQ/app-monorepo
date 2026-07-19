import fs from 'fs';
import path from 'path';

import { resolveNativeHomeListStateSlot } from './nativeHomeDataAdapters';

describe('Native Home state slot lifecycle', () => {
  const pageSource = fs.readFileSync(
    path.join(__dirname, 'NativeHomePage.native.tsx'),
    'utf8',
  );
  const adapterSource = fs.readFileSync(
    path.join(__dirname, 'nativeHomeDataAdapters.ts'),
    'utf8',
  );
  const perpsSource = fs.readFileSync(
    path.join(__dirname, 'pages/PerpsContainer.tsx'),
    'utf8',
  );
  const emptyHistorySource = fs.readFileSync(
    path.join(__dirname, '../../components/Empty/EmptyHistory.tsx'),
    'utf8',
  );
  const marketPerpsHookSource = fs.readFileSync(
    path.join(
      __dirname,
      '../Market/MarketHomeV2/components/MarketPerpsList/hooks/useMarketPerpsTokenList.ts',
    ),
    'utf8',
  );
  const nativeContainerSource = fs.readFileSync(
    path.join(
      __dirname,
      '../../../../native-components/src/HomeContainer.native.tsx',
    ),
    'utf8',
  );
  const swiftSource = fs.readFileSync(
    path.join(
      __dirname,
      '../../../../native-components/ios/HomeContainerView.swift',
    ),
    'utf8',
  );

  it('keeps one parked state slot for every committed tab', () => {
    expect(pageSource).toContain(
      'const committedTabIds = new Set(tabShells.map(({ id }) => id));',
    );
    ['portfolio', 'perps', 'defi', 'nft', 'history'].forEach((tabId) => {
      expect(pageSource).toMatch(new RegExp(`setSlot\\(\\s*'${tabId}'`));
    });
    expect(pageSource).not.toContain('[activeTabId]: {');
  });

  it('keeps loading and empty on the same diffable row and slot-host cell', () => {
    const stateIdInterpolation = ['$', '{id}'].join('');
    expect(adapterSource).toContain(`id: \`${stateIdInterpolation}:state\``);
    expect(swiftSource).toContain(
      'item.renderer == "empty" || item.renderer == "loading"',
    );
    expect(swiftSource).toContain(
      'nextSnapshot.reconfigureItems(cellUpdatePlan.reconfigureRowIds)',
    );
    expect(swiftSource).toMatch(
      /case \.item\(let item\):[\s\S]*?if let key = self\.slotKey\(for: row\)[\s\S]*?"slot-host"/,
    );
  });

  it('keeps the Fabric state slot height equal to the native row DTO', () => {
    expect(adapterSource).toContain('stateItem?.displayHeight !== undefined');
    expect(adapterSource).toContain('content: createContent(),');
    expect(adapterSource).toContain('height: stateItem.displayHeight,');
    expect(pageSource).toContain('resolveNativeHomeListStateSlot(');
    expect(pageSource).toContain('height,');
    expect(pageSource).toContain(
      "interaction: height === undefined ? 'none' : 'tap'",
    );
    expect(nativeContainerSource).toContain(
      'slot.height === undefined ? undefined : { height: slot.height }',
    );
  });

  it('uses stable Perps footer keys for ready and empty without duplicate support', () => {
    expect(pageSource).toContain("perps.viewState !== 'loading'");
    expect(pageSource).toContain('<SupportHub');
    expect(pageSource).toContain('nativeSlot');
    expect(pageSource).toContain('id: ETranslations.perp_guide_title');

    const stateSlotSource = perpsSource.slice(
      perpsSource.indexOf('export function PerpsHomeStateSlot'),
      perpsSource.indexOf('function PerpsMobileHoldingRow'),
    );
    expect(stateSlotSource).toContain(
      '<PerpsEmptyRecommendSection isActive={isActive} />',
    );
    expect(stateSlotSource).not.toContain('<Upgrade />');
    expect(stateSlotSource).not.toContain('<SupportHub');
  });

  it('parks the History loading and terminal empty content under one key', () => {
    expect(pageSource).toContain("setSlot('history', historySections");
    expect(pageSource).toContain('<EmptyHistory');
    expect(pageSource).toContain('<HistoryLoadingView />');
  });

  it.each(['defi', 'nft', 'history', 'perps'] as const)(
    'does not create a hidden %s state child when the tab has real rows',
    (renderer) => {
      const createContent = jest.fn(() => `${renderer}-state`);

      expect(
        resolveNativeHomeListStateSlot(
          [
            {
              id: `${renderer}-content`,
              items: [
                {
                  id: `${renderer}-row`,
                  renderer,
                  title: 'Real row',
                },
              ],
            },
          ],
          createContent,
        ),
      ).toEqual({ content: undefined, height: undefined });
      expect(createContent).not.toHaveBeenCalled();
    },
  );

  it('creates the state child lazily from the matching native state row', () => {
    const createContent = jest.fn(() => 'history-empty');

    expect(
      resolveNativeHomeListStateSlot(
        [
          {
            id: 'history-state',
            items: [
              {
                id: 'history-state:state',
                renderer: 'empty',
                title: 'Empty',
                displayHeight: 320,
              },
            ],
          },
        ],
        createContent,
      ),
    ).toEqual({ content: 'history-empty', height: 320 });
    expect(createContent).toHaveBeenCalledTimes(1);
  });

  it('keeps History empty hooks inside the lazy state factory', () => {
    expect(pageSource).toMatch(
      /setSlot\(\s*'history',\s*historySections,\s*\(\) =>[\s\S]*?<EmptyHistory/,
    );
  });

  it('focus-gates parked History account data and its nested address selector', () => {
    expect(pageSource).toContain("isActive={activeTabId === 'history'}");
    expect(emptyHistorySource).toMatch(
      /overrideIsFocused:\s*\(isPageFocused\) =>\s*isPageFocused && isActive/,
    );
    expect(emptyHistorySource).toMatch(
      /return isActive &&[\s\S]*?<AddressTypeSelector/,
    );
  });

  it('focus-gates the parked Perps recommendation poller', () => {
    expect(pageSource).toContain("if (perps.viewState === 'ready')");
    expect(pageSource).toContain("isActive={activeTabId === 'perps'}");
    expect(perpsSource).toContain(
      '<PerpsEmptyRecommendSection isActive={isActive} />',
    );
    expect(marketPerpsHookSource).toMatch(
      /overrideIsFocused:\s*\(isPageFocused\) =>\s*isPageFocused && isActive/,
    );
  });
});
