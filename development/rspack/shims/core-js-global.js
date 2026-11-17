// Firefox isolated worlds can expose a wrapped window.Math. core-js 2's identity
// check then falls through to Function(), which MV3 CSP correctly blocks.
module.exports = globalThis;
