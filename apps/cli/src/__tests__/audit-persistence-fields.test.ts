import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT = resolve(__dirname, '../../scripts/audit-persistence-fields.sh');

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'onekey-audit-persistence-'));
  const serviceSrcDir = join(dir, 'service-src');
  const dataDir = join(dir, 'data');
  const dataFile = join(dataDir, 'keys.json');
  const vaultFile = join(dir, 'vault.enc');

  mkdirSync(serviceSrcDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    dataFile,
    JSON.stringify({
      keyA: {
        keyBase64: 'AAAA',
        accessTokenSha256: 'BBBB',
        createdAt: 1,
      },
    }),
    'utf8',
  );
  writeFileSync(
    join(serviceSrcDir, 'register.ts'),
    `
      ctx.store.insert(keyId, {
        keyBase64,
        accessTokenSha256,
        createdAt: now,
      });
    `,
    'utf8',
  );
  writeFileSync(vaultFile, Buffer.from('OKBW encrypted payload'));

  return { dataFile, dir, serviceSrcDir, vaultFile };
}

function runAudit(fixture: ReturnType<typeof makeFixture>) {
  return spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      BOT_WALLET_KEY_API_DATA_FILE: fixture.dataFile,
      BOT_WALLET_KEY_API_SRC_DIR: fixture.serviceSrcDir,
      BOT_WALLET_VAULT_FILE: fixture.vaultFile,
    },
    timeout: 10_000,
  });
}

describe('audit-persistence-fields.sh', () => {
  let fixture: ReturnType<typeof makeFixture>;

  beforeEach(() => {
    fixture = makeFixture();
  });

  afterEach(() => {
    rmSync(fixture.dir, { recursive: true, force: true });
  });

  it('passes for whitelisted service persistence fields and clean vault raw bytes', () => {
    const result = runAudit(fixture);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('fails when keys.json contains a forbidden mnemonic field', () => {
    writeFileSync(
      fixture.dataFile,
      JSON.stringify({
        keyA: {
          keyBase64: 'AAAA',
          accessTokenSha256: 'BBBB',
          createdAt: 1,
          mnemonic: 'leak',
        },
      }),
      'utf8',
    );

    const result = runAudit(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('mnemonic');
  });

  it('fails when service source writes a forbidden persistence field', () => {
    writeFileSync(
      join(fixture.serviceSrcDir, 'register.ts'),
      `
        ctx.store.insert(keyId, {
          keyBase64,
          accessToken: token,
          createdAt: now,
        });
      `,
      'utf8',
    );

    const result = runAudit(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('accessToken');
  });

  it('fails when vault.enc raw bytes contain a forbidden field name', () => {
    writeFileSync(
      fixture.vaultFile,
      Buffer.from('OKBW encrypted bytes walletId'),
    );

    const result = runAudit(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('walletId');
  });
});
