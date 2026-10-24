const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('direct desktop and native transports resolve the patched core bundle', () => {
  const expectedCore = fs.realpathSync(require.resolve('@onekeyfe/hd-core'));
  for (const wrapper of [
    '@onekeyfe/hd-common-connect-sdk',
    '@onekeyfe/hd-ble-sdk',
  ]) {
    const entry = require.resolve(wrapper);
    const resolvedCore = require.resolve('@onekeyfe/hd-core', {
      paths: [path.dirname(entry)],
    });
    assert.equal(fs.realpathSync(resolvedCore), expectedCore);
    const source = fs.readFileSync(entry, 'utf8');
    assert.match(source, /HardwareSdk.getLogBlockLabel\(params\)/);
    assert.match(source, /blockLog \? '\[REDACTED\]' : response/);
  }
});

test('the shipped hardware SDK redacts BTC message requests and responses', () => {
  const sdkEntry =
    process.env.ONEKEY_TEST_HD_CORE_ENTRY ||
    require.resolve('@onekeyfe/hd-core');
  const source = fs.readFileSync(sdkEntry, 'utf8');
  const start = source.indexOf('const LogPayloadBlockMethod = new Set(');
  const end = source.indexOf('const HD_HARDENED =', start);
  assert.ok(
    start >= 0 && end > start,
    'Review the SDK logging patch after an upgrade',
  );
  // Execute the exact published bundle helpers in isolation. No SDK instance,
  // transport, wallet, app storage, or real signature is created by this test.
  const context = vm.createContext({ LogBlockEvent: new Set() });
  vm.runInContext(
    `${source.slice(start, end)}\nthis.helpers = { getLogBlockLabel, getSafeLogPayload };`,
    context,
  );
  const { getLogBlockLabel, getSafeLogPayload } = context.helpers;
  const syntheticSecret = 'SYNTHETIC_CLOUD_SIGNATURE_DO_NOT_LOG';
  const message = {
    payload: { method: 'btcSignMessage', messageHex: '616263' },
  };
  const label = getLogBlockLabel(message);
  assert.equal(label, 'btcSignMessage');
  const loggedRequest = getSafeLogPayload(message, label);
  const loggedResponse = getSafeLogPayload(
    { success: true, payload: { signature: syntheticSecret } },
    label,
  );
  assert.equal(loggedRequest.payload, '[REDACTED]');
  assert.equal(loggedResponse.payload, '[REDACTED]');
  assert.equal(
    JSON.stringify([loggedRequest, loggedResponse]).includes(syntheticSecret),
    false,
  );
  assert.match(
    source,
    /CALL_API_RESPONSE[^\n]*getSafeLogPayload\(response, logBlockLabel\)/,
  );
  assert.equal(
    getLogBlockLabel({ method: 'btcDeriveContextHash' }),
    'btcDeriveContextHash',
  );
  assert.equal(getLogBlockLabel({ method: 'btcGetAddress' }), undefined);
  assert.equal(path.basename(sdkEntry), 'index.js');
});

test('decoded protocol signatures cannot enter the real SDK log ring or events', () => {
  const sdk = require('@onekeyfe/hd-core');
  const transport = require('@onekeyfe/hd-transport');
  const syntheticSecret = 'SYNTHETIC_SIGNATURE_PROTOCOL_LOG_TEST';
  const events = [];
  sdk.setLoggerPostMessage((event) => events.push(event));
  try {
    const logger = sdk.getLogger(sdk.LoggerNames.DeviceCommands);
    for (const protocol of ['V1', 'V2']) {
      const request = transport.createTransportCallLog(
        'SignMessage',
        protocol,
        {
          message: 'public test message',
        },
      );
      assert.equal(request.request, '[REDACTED]');
      const response = {
        type: 'MessageSignature',
        message: transport.getSafeTransportLogPayload(
          { address: 'public test address', signature: syntheticSecret },
          'MessageSignature',
        ),
      };
      assert.equal(response.message, '[REDACTED]');
      logger.debug('_filterCommonTypes:', { request: 'SignMessage', response });
    }
    assert.equal(JSON.stringify(sdk.getLog()).includes(syntheticSecret), false);
    assert.equal(JSON.stringify(events).includes(syntheticSecret), false);
    const entry = fs.readFileSync(require.resolve('@onekeyfe/hd-core'), 'utf8');
    assert.match(
      entry,
      /message: hdTransport.getSafeTransportLogPayload\(res.message, res.type\)/,
    );
  } finally {
    sdk.setLoggerPostMessage(() => undefined);
  }
});
