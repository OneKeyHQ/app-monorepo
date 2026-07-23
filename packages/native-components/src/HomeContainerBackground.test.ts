import fs from 'fs';
import path from 'path';

import { resolveHomeContainerBackgroundColor } from './HomeContainerBackground';

describe('resolveHomeContainerBackgroundColor', () => {
  it('uses dark slots while a controller-owned snapshot prop is absent', () => {
    expect(
      resolveHomeContainerBackgroundColor({
        slotBackgroundColor: '#0F0F0F',
        snapshotBackgroundColor: undefined,
      }),
    ).toBe('#0F0F0F');
  });

  it('keeps the snapshot authoritative over a fallback slot color', () => {
    expect(
      resolveHomeContainerBackgroundColor({
        slotBackgroundColor: '#FFFFFF',
        snapshotBackgroundColor: '#0F0F0F',
      }),
    ).toBe('#0F0F0F');
  });

  it('uses white only when neither snapshot nor slots provide a color', () => {
    expect(resolveHomeContainerBackgroundColor({})).toBe('#FFFFFF');
  });

  it('feeds the same resolved color to the host and every slot', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'HomeContainer.native.tsx'),
      'utf8',
    );
    expect(source).toContain('{ backgroundColor: resolvedBackgroundColor }');
    expect(source).toContain('backgroundColor={resolvedBackgroundColor}');
  });
});
