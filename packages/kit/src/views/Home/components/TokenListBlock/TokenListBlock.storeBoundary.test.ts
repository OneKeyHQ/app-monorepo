import fs from 'fs';
import path from 'path';

describe('Home portfolio Store boundary', () => {
  const rendererSource = fs.readFileSync(
    path.join(__dirname, 'TokenListBlock.tsx'),
    'utf8',
  );
  const sourceRuntime = fs.readFileSync(
    path.join(__dirname, '../../model/sources/homeSourceRuntime.ts'),
    'utf8',
  );
  const allNetworkHookSource = fs.readFileSync(
    path.join(__dirname, '../../../../hooks/useAllNetwork.ts'),
    'utf8',
  );
  const tokenListViewSource = fs.readFileSync(
    path.join(__dirname, '../../../../components/TokenListView/index.tsx'),
    'utf8',
  );

  it('keeps BG production and Home Store publication out of the renderer', () => {
    expect(rendererSource).not.toContain('backgroundApiProxy');
    expect(rendererSource).not.toContain('usePromiseResult');
    expect(rendererSource).not.toContain('useHomeStoreSourcePublisher');
    expect(rendererSource).not.toContain('useListStructureAtom');
    expect(rendererSource).not.toContain('useTokenListContextData');
    expect(rendererSource).not.toContain('useHomeTokenListOwnerKey');
    expect(rendererSource).not.toContain('useTokenSelectorFilterPersistAtom');
    expect(rendererSource).toContain('useHomePortfolioIntents');
    expect(rendererSource).toContain("useHomeSectionPayload('portfolio')");
  });

  it('owns Portfolio scheduling and exact-run publication outside React', () => {
    expect(sourceRuntime).toContain('private async loadPortfolio(');
    expect(sourceRuntime).toContain('this.allNetworkAccounts.get(');
    expect(sourceRuntime).toContain('this.host.leafPool.run(priority');
    expect(sourceRuntime).toContain('publishIntermediate({');
    expect(sourceRuntime).toContain('createHomeResultSink({');
    expect(sourceRuntime).not.toMatch(/from ['"]react['"]/);
    expect(allNetworkHookSource).toContain('resultForFinished = resp');
    expect(allNetworkHookSource).toContain('result: resultForFinished');
  });

  it('prevents TokenListView Home mode from fetching network metadata', () => {
    expect(tokenListViewSource).toContain(
      'needNetworksMap && !props.enableCellSeam && !props.hostNetworksMap',
    );
    expect(tokenListViewSource).toContain(
      'backgroundApiProxy.serviceNetwork.getAllNetworks()',
    );
  });
});
