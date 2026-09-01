const { parseArgs } = require('../build-mobile-dev-shell');

describe('build-mobile-dev-shell', () => {
  it('parses one platform build without combining native targets', () => {
    expect(
      parseArgs([
        'build',
        '--platform',
        'ios',
        '--output',
        '/tmp/onekey-shell',
        '--result',
        '/tmp/onekey-shell-result.json',
        '--skip-pods',
      ]),
    ).toEqual({
      outputDirectory: '/tmp/onekey-shell',
      platform: 'ios',
      resultPath: '/tmp/onekey-shell-result.json',
      skipPods: true,
    });
  });

  it('rejects a combined or unsupported platform', () => {
    expect(() => parseArgs(['build', '--platform', 'all'])).toThrow(
      '--platform must be android or ios',
    );
  });
});
