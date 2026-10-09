const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const ts = require('typescript');

const {
  generate,
  publicMethods,
  update,
} = require('./generate-desktop-api-methods');

test('extracts only public instance callables before visibility is erased', () => {
  assert.deepEqual(
    publicMethods(
      `
      class Api implements Contract {
        public visible() {}
        implicit() {}
        arrow = () => {};
        private hidden() {}
        protected internal() {}
        #secret() {}
        private hiddenArrow = () => {};
        static utility() {}
        constructor() {}
        get getter() { return 1; }
        overloaded(value: string): void;
        overloaded(value: number): void;
        overloaded(value: unknown) {}
      }
      export default Api;
    `,
      'fixture.ts',
    ),
    ['arrow', 'implicit', 'overloaded', 'visible'],
  );
});

test('fails closed for inheritance and dynamic callable names', () => {
  assert.throws(
    () =>
      publicMethods('export default class Api extends Base {}', 'fixture.ts'),
    /Unsupported desktop API class/,
  );
  assert.throws(
    () =>
      publicMethods('export default class Api { [name]() {} }', 'fixture.ts'),
    /statically known/,
  );
});

test('the committed policy is reproducible from every registered desktop API', async () => {
  await update(true);
  const output = await generate();
  const code = ts.transpile(output, { module: ts.ModuleKind.CommonJS });
  const module = { exports: {} };
  vm.runInNewContext(code, { exports: module.exports });
  const table = module.exports.desktopApiPublicMethods;
  assert(Object.isFrozen(table));
  assert(Object.isFrozen(table.appUpdate));
  for (const method of [
    'launchWindowsInstaller',
    'stageMacUpdate',
    'installAppImage',
    'writeRecord',
    'getMainWindow',
  ]) {
    assert.equal(table.appUpdate.includes(method), false);
  }
  assert(table.appUpdate.includes('installPackage'));
  assert(table.firmwareArtifact.includes('download'));
});
