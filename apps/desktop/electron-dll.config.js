// oxlint-disable no-template-curly-in-string -- electron-builder template syntax
// The supplemental runtime is absent from dll/arm64 because Microsoft's ARM64
// redistributable provides an AMD64 copy and no packaged ARM64 binary imports it.
const DLLs = [
  {
    from: 'dll/${arch}',
    to: '.',
    filter: [
      'msvcp140.dll',
      'vccorlib140.dll',
      'vcruntime140_1.dll',
      'vcruntime140.dll',
    ],
  },
];

module.exports = DLLs;
