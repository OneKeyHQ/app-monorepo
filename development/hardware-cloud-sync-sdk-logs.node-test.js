const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

test('hardware SDK caches and emits redacted Bitcoin signing payloads', () => {
  const bundle = fs.readFileSync(require.resolve('@onekeyfe/hd-core'), 'utf8');
  const section = (start, end) => {
    const first = bundle.indexOf(start);
    const last = bundle.indexOf(end, first);
    assert.ok(first >= 0 && last > first, `SDK section: ${start}`);
    return bundle.slice(first, last);
  };
  const emitted = [];
  const context = vm.createContext({
    UI_REQUEST: {},
    UI_RESPONSE: {},
    LOG: { OUTPUT: 'output' },
    createLogMessage: (type, payload) => ({ type, payload }),
    emit: (message) => emitted.push(message),
  });
  // Execute the installed runtime's redactor and log ring, including the
  // patch-package change, without opening a device or starting the SDK.
  vm.runInContext(
    `${section('const LogBlockEvent =', 'const HD_HARDENED =')}
     ${section('const MAX_ENTRIES = 500;', 'exports.LoggerNames = void 0;')}
     setLoggerPostMessage(emit);
     const logger = initLog('test', false);
     const request = { payload: { method: 'btcSignMessage', messageHex: 'public-test-message' } };
     const label = getLogBlockLabel(request);
     logger.log(getSafeLogPayload(request, label));
     logger.log(getSafeLogPayload({ payload: { signature: 'public-test-secret-signature' } }, label));
     logger.log(getSafeLogTask({ id: 1, method: { payload: request.payload } }));
     globalThis.captured = JSON.stringify(getLog());
     globalThis.label = label;
     globalThis.ordinary = getSafeLogPayload({ payload: { firmware: '1.0.0' } });`,
    context,
  );
  assert.equal(context.label, 'btcSignMessage');
  for (const output of [context.captured, JSON.stringify(emitted)]) {
    assert.match(output, /REDACTED/u);
    assert.doesNotMatch(output, /public-test-(?:secret-signature|message)/u);
  }
  assert.equal(context.ordinary.payload.firmware, '1.0.0');
});
