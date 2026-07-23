import fs from 'fs';
import path from 'path';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, relativePath), 'utf8');

const rendererSource = read('DeFiListBlock.tsx');
const protocolSource = read('Protocol.tsx');
const protocolRowSource = read('ProtocolRow.tsx');
const containerSource = read('../../pages/DeFiContainer.tsx');
const sourceController = read('../../model/react/useHomeDeFiStoreSource.ts');
const rootController = read('../../model/react/HomeDeFiStoreController.tsx');
const intents = read('../../model/react/homeDeFiIntents.ts');

describe('Home DeFi Store authority', () => {
  it('keeps every DeFi renderer on Store data plus pure UI state', () => {
    expect(rendererSource).toContain("useHomeSectionPayload('defi')");
    expect(rendererSource).toContain("useHomeResource('defi')");
    expect(containerSource).toContain("useHomeSectionPayload('defi')");
    for (const source of [
      rendererSource,
      protocolSource,
      protocolRowSource,
      containerSource,
    ]) {
      expect(source).not.toMatch(
        /useDeFiList(Protocols|ProtocolMap|State|SupportedActions)Atom/,
      );
    }
  });

  it('keeps the renderer free of source publishers and background requests', () => {
    expect(rendererSource).toContain('useHomeDeFiIntents()');
    expect(rendererSource).not.toMatch(
      /backgroundApiProxy|useAllNetworkRequests|usePromiseResult|useHomeStoreSourcePublisher|publishHomeSectionSource/,
    );
    expect(rendererSource).not.toMatch(
      /updateDeFiList(Protocols|ProtocolMap|State|SupportedActions)/,
    );
  });

  it('physically retires the native DeFi producer', () => {
    expect(
      fs.existsSync(path.join(__dirname, '../../useNativeHomeDeFiData.ts')),
    ).toBe(false);
  });

  it('opens one logical Store request before each single/all-network source await', () => {
    const single = sourceController.slice(
      sourceController.indexOf('const loadSingle'),
      sourceController.indexOf('const fetchAllNetwork'),
    );
    const allNetwork = sourceController.slice(
      sourceController.indexOf('const handleAllNetworkStarted'),
      sourceController.indexOf('const handleAllNetworkAccountsData'),
    );
    expect(single.indexOf("evidence: { kind: 'loading' }")).toBeLessThan(
      single.indexOf('fetchAccountDeFiPositions'),
    );
    expect(allNetwork.indexOf("evidence: { kind: 'loading' }")).toBeLessThan(
      allNetwork.indexOf('consumeManualDeFiForceRefreshQuota'),
    );
    expect(sourceController).toContain('requestHandleBySeqRef.current.set');
    expect(sourceController).toContain('completeHomeSectionRequest(');
    expect(sourceController).not.toContain('publishHomeSectionSource');
  });

  it('has one owner for cache, polling, events, and action refresh', () => {
    expect(sourceController).toContain('refreshCacheOnly');
    expect(sourceController).toContain('POLLING_INTERVAL_FOR_DEFI');
    expect(sourceController).toContain('DeFiPositionRefreshed');
    expect(sourceController).toContain('subscribeHomeDeFiSourceCommand');
    expect(sourceController).toContain(
      'refreshAccountDeFiPositionsAfterAction',
    );
    expect(intents).toContain('dispatchHomeIntent({');
    expect(intents).toContain("execution: 'controller'");
    expect(rootController).toContain('pendingSectionCommands.filter');
    expect(rootController).toContain('markHomeSectionCommandHandled');
  });

  it('prefetches the Store contributor whenever the DeFi tab is available', () => {
    expect(rootController).toContain("navigation.value.tabs.includes('defi')");
    expect(rootController).toContain('refreshCacheOnly: false');
  });

  it('keys all-network request reuse to the current Store owner session', () => {
    expect(sourceController).toContain('runIdentityKey: deFiSourceIdentityKey');
  });
});
