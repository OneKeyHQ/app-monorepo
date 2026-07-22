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

  it('owns the source lifecycle in the controller', () => {
    expect(controllerSource).toContain('beginHomeSectionRequest');
    expect(controllerSource).toContain('completeHomeSectionRequest');
    expect(controllerSource).toContain(
      'beginPortfolioStoreRequestRef.current()',
    );
    expect(controllerSource).toContain('walletTokenSnapshot');
    expect(controllerSource).toContain(
      'EHomeBackgroundRecoveryRefreshDomain.portfolio',
    );
  });

  it('binds single-network responses to their request owner and explicit terminal', () => {
    expect(controllerSource).toContain(
      'requestOwnerKey === cellsIngestInputsRef.current.ownerKey',
    );
    expect(controllerSource).toContain('ownerKey: requestOwnerKey');
    expect(controllerSource).toContain(
      'pendingSingleNetworkReadyCompletionRef.current',
    );
    expect(controllerSource).toContain(
      'isHomePortfolioValuationReceiptApplied({',
    );
    expect(controllerSource).toContain('expected: pending.valuationReceipt');
    expect(controllerSource).toContain(
      'completeRequest: completeHomeSectionRequest',
    );
  });

  it('finalizes all-network data from the exact completed run', () => {
    expect(controllerSource).toContain(
      'await finalizeAllNetworksTokenListRef.current({',
    );
    expect(controllerSource).toContain('finishedResult: result ?? []');
    expect(controllerSource).toContain('requestRound: runContext.requestRound');
    expect(controllerSource).toContain(
      'legacyAllNetworkOutcomeRef.current === outcome',
    );
    expect(controllerSource).not.toContain('result: allNetworksResult');
    expect(controllerSource).not.toContain('allNetworkFinalizeRevision');
    expect(allNetworkHookSource).toContain('resultForFinished = resp');
    expect(allNetworkHookSource).toContain('result: resultForFinished');
    expect(controllerSource).toContain(
      'pendingAllNetworkReadyCompletionRef.current',
    );
    expect(controllerSource).toContain(
      'const valuationReceipt = await commitAuthoritativeIngest(snapshot)',
    );
    expect(controllerSource).toContain('ownerKey: valuationReceipt.ownerKey');
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
