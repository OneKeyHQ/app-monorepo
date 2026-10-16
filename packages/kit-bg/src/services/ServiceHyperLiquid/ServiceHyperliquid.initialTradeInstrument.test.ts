import ServiceHyperliquid from './ServiceHyperliquid';

jest.mock('p-timeout', () => ({
  __esModule: true,
  default: (promise: Promise<unknown>) => promise,
}));
jest.mock('@nktkas/hyperliquid', () => ({}));
jest.mock('./hyperLiquidApiClients', () => ({ hyperLiquidApiClients: {} }));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  toastIfError: () => (_target: unknown, _key: string, descriptor: unknown) =>
    descriptor,
}));

function createService() {
  // Exercise the handoff without starting unrelated account/subscription work.
  const service = Object.create(
    ServiceHyperliquid.prototype,
  ) as ServiceHyperliquid;
  jest.spyOn(service, 'getActiveTradeInstrumentTarget').mockResolvedValue({
    mode: 'perp',
    spotAsset: undefined,
    perpAsset: undefined,
  });
  jest
    .spyOn(service, 'getTradingUniverse')
    .mockResolvedValue({ universesByDex: [], marginTablesMapByDex: [] });
  return service;
}

afterEach(() => jest.restoreAllMocks());

it('does not consume a target from a cancelled navigation on first mount', async () => {
  const service = createService();
  await service.setPendingInitialTradeInstrument({
    coin: 'BTC',
    mode: 'perp',
    requestId: 'cancelled',
  });
  await service.clearPendingInitialTradeInstrument({ requestId: 'cancelled' });
  const initial = await service.prepareInitialSymbolSelect();
  expect(initial.claimed).toBe(true);
  expect(initial.pendingInitialTradeInstrument).toBeUndefined();
});

it('keeps a newer request for the same coin when the older request is cancelled', async () => {
  const service = createService();
  await service.setPendingInitialTradeInstrument({
    coin: 'BTC',
    mode: 'perp',
    requestId: 'first',
  });
  await service.setPendingInitialTradeInstrument({
    coin: 'BTC',
    mode: 'perp',
    requestId: 'second',
  });
  await service.clearPendingInitialTradeInstrument({ requestId: 'first' });
  const initial = await service.prepareInitialSymbolSelect();
  expect(initial.pendingInitialTradeInstrument).toEqual({
    coin: 'BTC',
    mode: 'perp',
  });
});

it('does not clear an instrument selected by an unowned caller', async () => {
  const service = createService();
  await service.setPendingInitialTradeInstrument({
    coin: 'BTC',
    mode: 'perp',
    requestId: 'first',
  });
  await service.setPendingInitialTradeInstrument({ coin: 'ETH', mode: 'perp' });
  await service.clearPendingInitialTradeInstrument({ requestId: 'first' });
  const initial = await service.prepareInitialSymbolSelect();
  expect(initial.pendingInitialTradeInstrument).toEqual({
    coin: 'ETH',
    mode: 'perp',
  });
});

it('preserves the first-mount latch after clearing a cancelled request', async () => {
  const service = createService();
  await service.tryClaimInitialSymbolSelect();
  await service.setPendingInitialTradeInstrument({
    coin: 'BTC',
    mode: 'perp',
    requestId: 'first',
  });
  await service.clearPendingInitialTradeInstrument({ requestId: 'first' });
  expect(await service.tryClaimInitialSymbolSelect()).toBe(false);
});
