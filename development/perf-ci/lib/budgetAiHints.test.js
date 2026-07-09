const fs = require('fs');
const os = require('os');
const path = require('path');

const { createWebColdAiHints } = require('./budgetAiHints');

function writeFile(repoRoot, filePath, source) {
  const fullPath = path.join(repoRoot, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, source);
}

function buildScenario({ name, script }) {
  return {
    name,
    path: `/${name}`,
    budgetChecks: [],
    healthChecks: [],
    runs: [
      {
        runIndex: 1,
        jsDecodedBytes: script.decodedBodySize,
        scriptCount: 1,
        rawResourceCount: 1,
        rawScriptEntryCount: 1,
        uniqueResourceCount: 1,
        uniqueScriptCount: 1,
        uniqueJsDecodedBytes: script.decodedBodySize,
        scripts: [script],
        uniqueScripts: [script],
        topScripts: [script],
      },
    ],
  };
}

describe('createWebColdAiHints', () => {
  it('caches script sourcemap summaries without sharing timing fields', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-hints-'));
    const buildDir = path.join(repoRoot, 'build');
    const scriptRelPath = 'static/js/chunk.js';
    const scriptUrl = `https://localhost/${scriptRelPath}?v=1`;
    const firstScript = {
      url: scriptUrl,
      decodedBodySize: 100,
      transferSize: 50,
      startTime: 10,
      duration: 5,
    };
    const secondScript = {
      ...firstScript,
      decodedBodySize: 120,
      startTime: 30,
      duration: 7,
    };

    writeFile(buildDir, scriptRelPath, 'console.log("chunk");');
    writeFile(
      buildDir,
      `${scriptRelPath}.map`,
      JSON.stringify({
        sources: [
          'webpack://onekey/packages/kit/src/a.ts',
          'webpack://onekey/node_modules/pkg/index.js',
        ],
      }),
    );

    const readFileSyncSpy = jest.spyOn(fs, 'readFileSync');

    const hints = createWebColdAiHints({
      report: {
        scenarios: [
          buildScenario({ name: 'root', script: firstScript }),
          buildScenario({ name: 'market', script: secondScript }),
        ],
      },
      buildDir,
      repoRoot,
    });

    const mapReadCount = readFileSyncSpy.mock.calls.filter(([filePath]) =>
      String(filePath).endsWith(`${scriptRelPath}.map`),
    ).length;

    readFileSyncSpy.mockRestore();

    expect(mapReadCount).toBe(1);
    expect(hints.scenarios[0].topScriptsByDecodedSize[0].startTime).toBe(10);
    expect(hints.scenarios[1].topScriptsByDecodedSize[0].startTime).toBe(30);
    expect(hints.scenarios[1].topScriptsByDecodedSize[0].decodedBodySize).toBe(
      120,
    );
  });
});
