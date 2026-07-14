const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  findForbiddenModules,
  getMissingSourceMaps,
  getModuleRows,
  getScriptFilesFromUrls,
} = require('./sourceMapSourceGuard');

describe('sourceMapSourceGuard', () => {
  let buildDir;

  beforeEach(() => {
    buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-map-guard-'));
    fs.mkdirSync(path.join(buildDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(buildDir, 'assets', 'app.js'), 'app');
    fs.writeFileSync(
      path.join(buildDir, 'assets', 'app.js.map'),
      JSON.stringify({
        sources: [
          'webpack:///../../packages/kit/src/views/Onboardingv2/components/Layout.tsx',
          'webpack:///../../packages/shared/src/routes/onboardingv2.ts',
        ],
        sourcesContent: ['layout', 'routes'],
      }),
    );
  });

  afterEach(() => {
    fs.rmSync(buildDir, { recursive: true, force: true });
  });

  it('checks sources from scripts requested during cold start', () => {
    const scriptFiles = getScriptFilesFromUrls({
      buildDir,
      scriptUrls: [
        'http://127.0.0.1:8080/assets/app.js?cache=1',
        'https://analytics.example/external.js',
      ],
    });
    const moduleRows = getModuleRows({ buildDir, scriptFiles });

    expect(scriptFiles).toEqual(['assets/app.js']);
    expect(getMissingSourceMaps({ buildDir, scriptFiles })).toEqual([]);
    expect(
      findForbiddenModules({
        moduleRows,
        forbiddenSources: [
          'packages/kit/src/views/Onboardingv2/components/Layout',
        ],
      }).map((row) => row.source),
    ).toEqual(['packages/kit/src/views/Onboardingv2/components/Layout.tsx']);
  });
});
