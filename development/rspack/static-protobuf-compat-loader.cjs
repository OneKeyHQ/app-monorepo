const assert = require('node:assert/strict');

// @onekeyfe/hd-transport@1.2.11-alpha.5 builds its reflection root before
// installing static codecs. protobufjs 7 resolves constructors during
// Root.fromJSON, which would trigger dynamic code generation in the extension.
const transportParser = `function parseTransportConfigure(data) {
    const root = parseConfigure(data);
    installStaticCodecs(root);
    return root;
}`;

const staticTransportParser = `function parseTransportConfigure(data) {
    const schema = typeof data === 'string' ? JSON.parse(data) : data;
    const root = new protobuf__namespace.Root();
    if (schema.options) root.setOptions(schema.options);
    root.addJSON(schema.nested ?? {});
    return installStaticCodecs(root) ? root : parseConfigure(schema);
}`;

module.exports = function applyStaticProtobufCompatibility(source) {
  const start = source.indexOf(transportParser);
  assert.ok(
    start !== -1 && source.indexOf(transportParser, start + 1) === -1,
    'Unexpected hd-transport@1.2.11-alpha.5 protobuf parser',
  );
  return source.replace(transportParser, staticTransportParser);
};
