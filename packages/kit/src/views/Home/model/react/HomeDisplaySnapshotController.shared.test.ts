import fs from 'fs';
import path from 'path';

const controllerSource = fs.readFileSync(
  path.join(__dirname, 'HomeDisplaySnapshotController.shared.tsx'),
  'utf8',
);

describe('HomeDisplaySnapshotController cache warming', () => {
  it('warms every lazy Home list source', () => {
    expect(controllerSource).toContain(
      "const HOME_BACKGROUND_SNAPSHOT_SOURCE_IDS = [\n  'perps',\n  'defi',\n  'nft',\n  'history',",
    );
    expect(controllerSource).toContain(
      'resolvedContext.manifest.chunks[sourceId]',
    );
  });

  it('keeps lazy chunk warming outside the initial display critical path', () => {
    expect(controllerSource).toContain('void warmCachedSources();');
    expect(controllerSource).toContain('void warmCachedSources(context);');
    expect(controllerSource).not.toContain('await warmCachedSources(context);');
  });
});
