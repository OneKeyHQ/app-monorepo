import fs from 'fs';
import path from 'path';

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

describe('Home History Store authority', () => {
  it('keeps full History and RecentHistory on one Store payload', () => {
    const renderer = readSource('TxHistoryContainer.tsx');
    const recent = readSource('../components/RecentHistory/RecentHistory.tsx');

    expect(renderer).toContain("useHomeSectionPayload('history')");
    expect(renderer).toContain('selectRecentHomeHistoryRows(');
    expect(recent).toContain('<TxHistoryListContainer');
    expect(recent).toContain('limit={5}');
    expect(recent).not.toContain('fetchAccountHistory');
    expect(recent).not.toContain('useHomeStoreSourcePublisher');
  });

  it('keeps the renderer free of request, cache, polling and source-event ownership', () => {
    const renderer = readSource('TxHistoryContainer.tsx');
    const forbiddenDependencies = [
      'backgroundApiProxy',
      'usePromiseResult',
      'useAllNetworkRequests',
      'useHistoryListLoadMore',
      'useHomeStoreSourcePublisher',
      'publishHomeSectionSource',
      'getAccountsLocalHistoryTxs',
      'getLocalAddressesInfo',
      'updateLocalAddressesInfo',
      'useHomeTokenListSnapshot',
      'useAddressesInfoAtom',
      'appEventBus.on',
      'POLLING_INTERVAL_FOR_HISTORY',
    ];
    forbiddenDependencies.forEach((dependency) => {
      expect(renderer).not.toContain(dependency);
    });
    expect(renderer).toContain('useHomeHistoryIntents()');
    expect(renderer).toContain("useHomeResource('history')");
    expect(renderer).toContain('pendingSectionCommands.some');
  });

  it('passes the complete History display payload through the Store boundary', () => {
    const renderer = readSource('TxHistoryContainer.tsx');
    const list = readSource('../../../components/TxHistoryListView/index.tsx');
    const description = readSource(
      '../../../components/TxAction/TxActionCommon.tsx',
    );

    expect(renderer).toContain('addressMap={payload?.addressMap ?? {}}');
    expect(renderer).toContain('tokenMap={payload?.tokenMap ?? {}}');
    expect(list).toContain('TxActionAddressMapProvider');
    expect(description).toContain('useTxActionAddressMap()');
  });

  it('physically retires the Native-only History producer/adapter', () => {
    expect(
      fs.existsSync(path.join(__dirname, '../useNativeHomeHistoryData.ts')),
    ).toBe(false);
  });
});
