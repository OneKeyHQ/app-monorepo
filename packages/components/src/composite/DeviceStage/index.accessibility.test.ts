import { readFileSync } from 'fs';
import { join } from 'path';

describe('DeviceStage outcome accessibility', () => {
  it('announces the successful capsule without interrupting other steps', () => {
    const source = readFileSync(join(__dirname, 'index.tsx'), 'utf8');

    expect(source).toContain("accessible={capsuleGlyph === 'done'}");
    expect(source).toContain("capsuleGlyph === 'done' ? 'polite' : 'none'");
    expect(source).toContain(
      "capsuleGlyph === 'done' ? capsuleText.title : undefined",
    );
  });
});
