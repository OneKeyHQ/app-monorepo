import fs from 'fs';
import path from 'path';

describe('Native Home portfolio scope contracts', () => {
  const hookSource = fs.readFileSync(
    path.join(__dirname, 'useNativeHomePortfolioData.ts'),
    'utf8',
  );
  const pageSource = fs.readFileSync(
    path.join(__dirname, 'NativeHomePage.native.tsx'),
    'utf8',
  );
  const allNetworksTriggerSource = fs.readFileSync(
    path.join(
      __dirname,
      '../../components/AccountSelector/AllNetworksManagerTrigger.tsx',
    ),
    'utf8',
  );
  const listItemSource = fs.readFileSync(
    path.join(__dirname, '../../components/ListItem/index.tsx'),
    'utf8',
  );
  const portfolioNetworkItemSource = fs.readFileSync(
    path.join(
      __dirname,
      '../ChainSelector/components/AllNetworksManager/NetworkListItem.tsx',
    ),
    'utf8',
  );
  const editableNetworkItemSource = fs.readFileSync(
    path.join(
      __dirname,
      '../ChainSelector/components/EditableChainSelector/EditableListItem.tsx',
    ),
    'utf8',
  );

  it('guards every external All Networks materialization path by owner', () => {
    const getHookBlock = (start: string, end: string) =>
      hookSource.slice(hookSource.indexOf(start), hookSource.indexOf(end));
    expect(hookSource).toContain('nativeHomeOwnerScopeKey');
    expect(hookSource).toContain('nativeHomeGeneration');
    expect(
      getHookBlock(
        'const applyAllNetworkCache',
        'const handleAllNetworkSettled',
      ),
    ).toContain('isNativeHomePortfolioRequestCurrent');
    expect(
      getHookBlock(
        'const handleAllNetworkSettled',
        'const clearAllNetworkData',
      ),
    ).toContain('isNativeHomePortfolioRequestCurrent');
    expect(
      getHookBlock(
        'const handleAllNetworkStarted',
        'const handleAllNetworkAccountsData',
      ),
    ).toContain('isOwnerCurrent');
    expect(
      getHookBlock(
        'const handleAllNetworkAccountsData',
        'const handleAllNetworkFinished',
      ),
    ).toContain('isOwnerCurrent');
    expect(
      getHookBlock('const handleAllNetworkFinished', 'useAllNetworkRequests<'),
    ).toContain('isOwnerCurrent');
    expect(hookSource).not.toContain('allNetworkGenerationRef.current = 0');
    expect(hookSource).toContain(
      'requestIdRef.current === hydrationGeneration',
    );
  });

  it('keeps stale materialized rows out of the current section patch', () => {
    expect(pageSource).toContain(
      'portfolioSource.dataScopeKey === expectedPortfolioScopeKey',
    );
    expect(pageSource).toContain('tokens: [],');
    expect(hookSource).toContain('setDataScopeKey(owner.scopeKey)');
  });

  it('renders the no-address terminal outside the heavy Native Home owner', () => {
    const missingAccountSource = pageSource.slice(
      pageSource.indexOf('function NativeHomeMissingAccountPage'),
      pageSource.indexOf('export function NativeHomePage'),
    );
    const guardSource = pageSource.slice(
      pageSource.indexOf('export function NativeHomePage'),
    );
    expect(missingAccountSource).toContain('<EmptyAccount');
    expect(missingAccountSource).not.toContain('<HomeContainer');
    expect(missingAccountSource).not.toContain('tabShells');
    expect(guardSource).toMatch(
      /shouldShowMissingAccount[\s\S]*?<NativeHomeMissingAccountPage \/>[\s\S]*?<NativeHomePageContent/,
    );
    expect(guardSource).toContain(
      'controllerOwnerRef = useRef<INativeHomeContainerControllerOwner>({})',
    );
    expect(pageSource).toContain('acquireNativeHomeContainerController({');
    expect(pageSource).toContain(
      'controller.detach(attachedControllerTargetRef.current)',
    );
  });

  it('puts network selector identifiers on iOS clickable leaves', () => {
    expect(allNetworksTriggerSource).toMatch(
      /if \(platformEnv\.isNativeIOS\)[\s\S]*?<NativeNetworkSelectorPressable[\s\S]*?onPress=\{handleOnPress\}[\s\S]*?testID="account-network-trigger-button"/,
    );
    expect(allNetworksTriggerSource).toContain(
      "pointerEvents={nestedInNativePressable ? 'none' : undefined}",
    );
    expect(listItemSource).toContain(
      'resolveNativeNetworkSelectorPressableTestIDs',
    );
    expect(listItemSource).toContain(
      "accessibilityRole={nativeClickableLeafTestID ? 'button' : undefined}",
    );
    expect(listItemSource).toContain('cancelable');
    expect(listItemSource).toContain('testID={contentTestID}');
    expect(portfolioNetworkItemSource).toMatch(
      /nativePressableTestID=\{`select-item-\$\{network\.id\}`\}/,
    );
    expect(portfolioNetworkItemSource).toMatch(
      /testID=\{`all-networks-manager-item-\$\{network\.id\}`\}/,
    );
    expect(editableNetworkItemSource).toMatch(
      /nativePressableTestID=\{`select-item-\$\{item\.id\}`\}/,
    );
    expect(editableNetworkItemSource).toContain('testID={item.id}');
  });
});
