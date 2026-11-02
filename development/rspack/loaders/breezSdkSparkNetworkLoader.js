// Binds the free `fetch` and `WebSocket` identifiers of the Breez SDK Spark
// wasm glue to OneKey's Spark network policy, so every request the SDK makes
// goes through it. Only the glue module is affected; the global fetch is not.
// See packages/kit-bg/src/services/ServiceLightningSpark/sdk/sparkNetwork.ts.
module.exports = function breezSdkSparkNetworkLoader(source) {
  return `import { sparkFetch as fetch, SparkWebSocket as WebSocket } from '@onekeyhq/kit-bg/src/services/ServiceLightningSpark/sdk/sparkNetwork';\n${source}`;
};
