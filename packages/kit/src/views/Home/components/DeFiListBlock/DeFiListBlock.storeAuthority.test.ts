import fs from 'fs';
import path from 'path';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, relativePath), 'utf8');

const rendererSource = read('DeFiListBlock.tsx');
const protocolSource = read('Protocol.tsx');
const protocolRowSource = read('ProtocolRow.tsx');
const containerSource = read('../../pages/DeFiContainer.tsx');
const sourceRuntime = read('../../model/sources/homeSourceRuntime.ts');
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

  it('keeps request, concurrency, polling, and action refresh in the plain runtime', () => {
    expect(sourceRuntime).toContain('private async loadDeFi(');
    expect(sourceRuntime).toContain('fetchAccountDeFiPositions');
    expect(sourceRuntime).toContain('this.host.leafPool.run');
    expect(sourceRuntime).toContain('POLLING_INTERVAL_MS');
    expect(sourceRuntime).toContain(
      "intent.actionId.endsWith('.positionActionSucceeded')",
    );
    expect(sourceRuntime).not.toMatch(/from ['"]react['"]/);
    expect(intents).toContain('dispatchHomeIntent({');
    expect(intents).not.toContain('execution:');
  });
});
