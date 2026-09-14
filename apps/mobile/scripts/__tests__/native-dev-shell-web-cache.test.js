const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getPreparedWebEmbedCache,
  hashFiles,
} = require('../../../web-embed/scripts/web-embed-prebundle');
const { prepareWebEmbedForDevSession } = require('../native-dev-shell');

describe('WebEmbed prepared output cache', () => {
  let directory;
  let options;
  let outputPath;
  beforeEach(() => {
    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-web-output-cache-'),
    );
    options = {
      inputKey: 'a'.repeat(64),
      webBuildDirectory: path.join(directory, 'web-build'),
      buildReceiptPath: path.join(directory, 'build.json'),
      restoredReceiptPath: path.join(directory, 'restored.json'),
    };
    fs.mkdirSync(options.webBuildDirectory);
    outputPath = path.join(options.webBuildDirectory, 'index.html');
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
  const writeOutput = (receiptPath) => {
    fs.writeFileSync(outputPath, '<html>WebEmbed</html>');
    fs.writeFileSync(
      receiptPath,
      JSON.stringify({
        schemaVersion: 1,
        inputKey: options.inputKey,
        outputTreeDigest: hashFiles([outputPath], options.webBuildDirectory),
      }),
    );
  };

  it.each(['buildReceiptPath', 'restoredReceiptPath'])(
    'reuses validated %s output',
    (receiptField) => {
      writeOutput(options[receiptField]);
      expect(getPreparedWebEmbedCache(options)).toMatchObject({
        source: 'local-cache',
        inputKey: options.inputKey,
      });
    },
  );

  it.each(['input', 'bytes', 'missing', 'empty', 'symlink'])(
    'invalidates output after %s changes',
    (change) => {
      writeOutput(options.buildReceiptPath);
      if (change === 'input') options.inputKey = 'b'.repeat(64);
      if (change === 'bytes') fs.writeFileSync(outputPath, 'modified');
      if (change === 'missing')
        fs.rmSync(options.webBuildDirectory, { recursive: true });
      if (change === 'empty' || change === 'symlink') fs.rmSync(outputPath);
      if (change === 'symlink')
        fs.symlinkSync(options.buildReceiptPath, outputPath);
      expect(getPreparedWebEmbedCache(options)).toBeUndefined();
    },
  );

  it('builds once after a 404 and skips both restore and build on the next launch', async () => {
    const restore = jest.fn().mockRejectedValue(new Error('HTTP 404'));
    const build = jest.fn(async () => writeOutput(options.buildReceiptPath));
    const dependencies = {
      restore,
      build,
      getCache: () => getPreparedWebEmbedCache(options),
    };
    const first = {
      runReportPath: path.join(directory, 'first.json'),
      userNotices: [],
    };
    const next = {
      runReportPath: path.join(directory, 'next.json'),
      userNotices: [],
    };
    const logger = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await prepareWebEmbedForDevSession(first, dependencies);
      await prepareWebEmbedForDevSession(next, dependencies);
      expect(restore).toHaveBeenCalledTimes(1);
      expect(build).toHaveBeenCalledTimes(1);
      expect(first.userNoticeRequired).toBe(true);
      expect(next.webEmbed).toMatchObject({
        source: 'local-cache',
        status: 'ready',
      });
      expect(next.userNotices).toEqual([]);
    } finally {
      logger.mockRestore();
    }
  });
});
