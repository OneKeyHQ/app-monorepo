const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const requireEas = createRequire(
  path.join(ROOT, '.github/tools/eas-cli/node_modules/eas-cli/package.json'),
);

test('patched EAS dependencies validate every existing mobile release profile', async () => {
  const { EasJsonAccessor, EasJsonUtils } = requireEas('@expo/eas-json');
  const accessor = EasJsonAccessor.fromProjectPath(
    path.join(ROOT, 'apps/mobile'),
  );
  for (const platform of ['ios', 'android']) {
    for (const profile of [
      'production',
      'production-store',
      'qa-internal',
      'qa-internal-store',
      'qa-internal-startup-profile',
    ]) {
      assert.ok(
        await EasJsonUtils.getBuildProfileAsync(accessor, platform, profile),
      );
    }
  }
});

test('patched Forge imports a password-protected signing credential and rejects invalid MAC iterations', () => {
  const forge = requireEas('node-forge');
  const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = forge.pki.privateKeyFromPem(
    keys.privateKey.export({ type: 'pkcs1', format: 'pem' }),
  );
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(
    keys.publicKey.export({ type: 'pkcs1', format: 'pem' }),
  );
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2020-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2030-01-01T00:00:00Z');
  cert.setSubject([{ name: 'commonName', value: 'CI credential fixture' }]);
  cert.setIssuer(cert.subject.attributes);
  cert.sign(key, forge.md.sha256.create());
  assert.ok(
    new crypto.X509Certificate(forge.pki.certificateToPem(cert)).verify(
      keys.publicKey,
    ),
  );

  const pfx = forge.pkcs12.toPkcs12Asn1(key, cert, 'fixture-password', {
    algorithm: 'aes256',
    count: 2048,
  });
  const imported = forge.pkcs12.pkcs12FromAsn1(pfx, 'fixture-password');
  // PKCS#12 identifier for a password-encrypted private key bag.
  const bagType = '1.2.840.113549.1.12.10.1.2';
  const bags = imported.getBags({ bagType });
  assert.equal(
    bags[bagType][0].key.n.toString(16),
    cert.publicKey.n.toString(16),
  );
  assert.throws(() =>
    forge.pkcs12.pkcs12FromAsn1(pfx, 'wrong-fixture-password'),
  );
  assert.throws(
    () =>
      forge.pkcs12.generateKey(
        'fixture-password',
        new forge.util.ByteBuffer('fixture-salt'),
        3,
        0,
        20,
      ),
    /iteration count/u,
  );
  const invalid = forge.asn1.fromDer(forge.asn1.toDer(pfx).getBytes());
  invalid.value[2].value[2].value = '\u0000';
  assert.throws(
    () => forge.pkcs12.pkcs12FromAsn1(invalid, 'fixture-password'),
    /iteration count/u,
  );
});
