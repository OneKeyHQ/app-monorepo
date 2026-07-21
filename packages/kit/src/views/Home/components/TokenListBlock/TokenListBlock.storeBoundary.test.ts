import fs from 'fs';
import path from 'path';

describe('Home portfolio Store boundary', () => {
  const rendererSource = fs.readFileSync(
    path.join(__dirname, 'TokenListBlock.tsx'),
    'utf8',
  );
  const controllerSource = fs.readFileSync(
    path.join(__dirname, 'HomePortfolioStoreController.tsx'),
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
    expect(rendererSource).toContain("useHomeSectionPayload('portfolio')");
  });

  it('owns the source lifecycle in the controller', () => {
    expect(controllerSource).toContain('beginHomeSectionRequest');
    expect(controllerSource).toContain('completeHomeSectionRequest');
    expect(controllerSource).toContain(
      'beginPortfolioStoreRequestRef.current()',
    );
    expect(controllerSource).toContain('walletTokenSnapshot');
    expect(controllerSource).toContain(
      'EHomeBackgroundRecoveryRefreshDomain.legacyWalletTokens',
    );
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
