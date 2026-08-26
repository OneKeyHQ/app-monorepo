// oxlint-disable no-template-curly-in-string -- electron-builder template syntax
const DLLs = [{ from: 'dll/${arch}/vcruntime140.dll', to: 'vcruntime140.dll' }];

module.exports = DLLs;
