import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type IRootPackageJson = {
  scripts: Record<string, string>;
};

const rootPackageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../package.json'), 'utf8'),
) as IRootPackageJson;

describe('BotWallet CI gate script', () => {
  it('keeps the release gate steps in the required order', () => {
    expect(rootPackageJson.scripts['test:unit']).toBe(
      'yarn workspace @onekeyfe/cli test:unit',
    );
    expect(rootPackageJson.scripts['test:integration:cli']).toBe(
      'yarn workspace @onekeyfe/cli test:integration:cli',
    );
    expect(rootPackageJson.scripts['ci:gate']).toBe(
      [
        'yarn lint:staged',
        'yarn tsc:staged',
        'yarn test:unit',
        'bash apps/cli/scripts/audit-persistence-fields.sh',
        'yarn test:integration:cli',
      ].join(' && '),
    );
  });
});
