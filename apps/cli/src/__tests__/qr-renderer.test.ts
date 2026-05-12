import { renderAsciiQr } from '../core/prime-transfer/qr-renderer';

describe('renderAsciiQr', () => {
  it('renders a pure-text QR matrix in under 500ms', () => {
    const startedAt = Date.now();
    const output = renderAsciiQr(
      'onekey-wallet://cross-device-transfer/?code=ABCDEFGH123-ABCDE-FGHIJ-KLMNP-QRSTU-VWXYZ-12345-6789A',
    );
    const elapsed = Date.now() - startedAt;

    const lines = output.split('\n');
    const widths = new Set(lines.map((line) => line.length));

    expect(elapsed).toBeLessThan(500);
    expect(output).not.toContain('onekey-wallet://');
    expect(lines.length).toBeGreaterThan(10);
    expect(widths.size).toBe(1);
    expect(output).toMatch(/[█▀▄]/u);
  });
});
