// oxlint-disable no-template-curly-in-string -- electron-builder template syntax
const DLLs = [
  { from: 'dll/${arch}/msvcp140.dll', to: 'msvcp140.dll' },
  { from: 'dll/${arch}/vccorlib140.dll', to: 'vccorlib140.dll' },
  { from: 'dll/${arch}/vcruntime140_1.dll', to: 'vcruntime140_1.dll' },
  { from: 'dll/${arch}/vcruntime140.dll', to: 'vcruntime140.dll' },
];

module.exports = DLLs;
