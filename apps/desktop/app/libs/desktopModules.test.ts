import fs from 'fs';
import os from 'os';
import path from 'path';

import policy from '../../scripts/verify-desktop-modules.cjs';

describe('desktop module release verification', () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-module-test-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  function fixture() {
    const name = 'electron-windows-hello';
    const nativeBinarySuffix = '-msvc.node';
    const sourceCommit = 'a'.repeat(40);
    const files = Object.fromEntries(
      [
        'LICENSE',
        'README.md',
        'index.cjs',
        'index.d.ts',
        'package.json',
        `${name}.win32-x64${nativeBinarySuffix}`,
        `${name}.win32-arm64${nativeBinarySuffix}`,
      ].map((file) => [file, policy.sha256(Buffer.from(file))]),
    );
    const release = {
      schemaVersion: 2,
      repository: 'OneKeyHQ/app-modules',
      workflow:
        'OneKeyHQ/app-modules/.github/workflows/desktop-win-release.yml',
      sourceCommit,
      sourceRef: 'refs/heads/codex/desktop-win-npm-release',
      baseline: {
        schemaVersion: 1,
        version: '44.0.2-alpha.1',
        electronVersion: '44.5.1',
        rustToolchain: '1.99.0',
        modules: { win: [name], mac: [], linux: [] },
      },
      modules: {
        [name]: {
          packageName: `@onekeyfe/${name}`,
          asset: `onekeyfe-${name}-44.0.2-alpha.1.tgz`,
          files,
        },
      },
    };
    const bytes = Buffer.from(JSON.stringify(release));
    const manifest = path.join(directory, 'desktop-win.json');
    fs.writeFileSync(manifest, bytes);
    const pin = {
      schemaVersion: 1,
      version: '44.0.2-alpha.1',
      sourceCommit,
      sourceRef: release.sourceRef,
      manifestSha256: policy.sha256(bytes),
    };
    return { release, manifest, pin };
  }

  it('requires the approved manifest bytes, source, version and release identity', () => {
    const { release, manifest, pin } = fixture();
    expect(policy.readApprovedRelease(manifest, pin)).toEqual(release);
    expect(() => {
      policy.readApprovedRelease(manifest, {
        ...pin,
        sourceCommit: 'b'.repeat(40),
      });
    }).toThrow('approved source/version');
    expect(() => {
      policy.readApprovedRelease(manifest, {
        ...pin,
        version: '44.0.2-alpha.2',
      });
    }).toThrow('approved source/version');
    expect(() => {
      policy.readApprovedRelease(manifest, {
        ...pin,
        sourceRef: 'refs/heads/other',
      });
    }).toThrow('approved source/version');
    fs.appendFileSync(manifest, '\n');
    expect(() => {
      policy.readApprovedRelease(manifest, pin);
    }).toThrow('digest mismatch');
    expect(() => {
      policy.validateRelease({
        ...release,
        repository: 'unexpected/repository',
      });
    }).toThrow('identity');
  });

  it('verifies the exact installed inventory without loading package code', () => {
    const bytes = Buffer.from("throw new Error('must not execute')");
    const file = path.join(directory, 'index.cjs');
    const inventory = { 'index.cjs': policy.sha256(bytes) };
    fs.writeFileSync(file, bytes);
    expect(() => policy.verifyRuntimeFiles(directory, inventory)).not.toThrow();
    fs.writeFileSync(path.join(directory, 'extra.node'), 'unexpected');
    expect(() => policy.verifyRuntimeFiles(directory, inventory)).toThrow(
      'Unexpected',
    );
    fs.unlinkSync(path.join(directory, 'extra.node'));
    fs.writeFileSync(file, 'modified');
    expect(() => policy.verifyRuntimeFiles(directory, inventory)).toThrow(
      'digest mismatch',
    );
    fs.unlinkSync(file);
    expect(() => policy.verifyRuntimeFiles(directory, inventory)).toThrow(
      'missing',
    );
  });

  it('requires proof from the pinned workflow, commit, exact branch and hosted runner', () => {
    const sourceCommit = 'a'.repeat(40);
    const sourceRef = 'refs/heads/codex/desktop-win-npm-release';
    expect(
      policy.attestationArgs('artifact', sourceCommit, sourceRef, 'proof'),
    ).toEqual([
      'attestation',
      'verify',
      'artifact',
      '--repo',
      'OneKeyHQ/app-modules',
      '--signer-workflow',
      'OneKeyHQ/app-modules/.github/workflows/desktop-win-release.yml',
      '--source-digest',
      sourceCommit,
      '--signer-digest',
      sourceCommit,
      '--source-ref',
      sourceRef,
      '--deny-self-hosted-runners',
      '--bundle',
      'proof',
    ]);
    expect(() => {
      policy.attestationArgs('artifact', 'main', sourceRef);
    }).toThrow('source commit');
    for (const invalid of ['main', 'refs/tags/latest', 'refs/heads/a..b']) {
      expect(() => {
        policy.attestationArgs('artifact', sourceCommit, invalid);
      }).toThrow('source branch ref');
    }
  });

  it('requires both packaged proof files and rejects extras or non-file metadata', () => {
    const file = path.join(directory, 'index.cjs');
    fs.writeFileSync(file, "throw new Error('must not execute')");
    const inventory = { 'index.cjs': policy.sha256(fs.readFileSync(file)) };
    expect(() =>
      policy.verifyRuntimeFiles(directory, inventory, policy.proofFiles),
    ).toThrow('missing');
    for (const name of policy.proofFiles)
      fs.writeFileSync(path.join(directory, name), '{}');
    expect(() =>
      policy.verifyRuntimeFiles(directory, inventory, policy.proofFiles),
    ).not.toThrow();
    const proof = path.join(directory, 'desktop-win.sigstore.json');
    fs.unlinkSync(proof);
    fs.mkdirSync(proof);
    expect(() =>
      policy.verifyRuntimeFiles(directory, inventory, policy.proofFiles),
    ).toThrow('metadata');
  });
});
