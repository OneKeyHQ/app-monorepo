// Plain JS, not TypeScript: the extension manifest is built by a `require`
// from a Node script and cannot import the TS config. Keeping the URL in one
// place stops the manifest's host permission and the node the wallet actually
// dials from drifting apart.
const XMR_BUILT_IN_NODE_URLS = ['https://xmr-node.cakewallet.com:18081'];

module.exports = { XMR_BUILT_IN_NODE_URLS };
