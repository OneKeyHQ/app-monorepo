/* oxlint-disable eslint/max-classes-per-file -- The DI probe needs a dependency and its injectable consumer. */
import assert from 'assert';

// Keep imports inside the tasks: fixtures load the real libraries for the first
// time only after the exact mobile adapter has hardened their realm.
export const SES_LIBRARY_TASKS = [
  {
    name: 'decimal.js after lockdown',
    run: async () => {
      const { default: Decimal } = await import('decimal.js');
      const Cloned = Decimal.clone({ precision: 30 });
      assert(new Cloned('0.1').plus('0.2').equals('0.3'));
      assert(
        new Decimal('12345678901234567890')
          .plus(1)
          .equals('12345678901234567891'),
      );
      return 'exact decimal arithmetic and constructor clone';
    },
  },
  {
    name: 'axios after lockdown',
    run: async () => {
      const { default: axios, AxiosHeaders } = await import('axios');
      const headers = new AxiosHeaders({ 'x-ses-fixture': '42' });
      assert.strictEqual(headers.get('X-SES-FIXTURE'), '42');
      const client = axios.create({
        adapter: async (config) => ({
          data: { value: 42 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }),
      });
      const response = await client.get<{ value: number }>(
        'https://example.invalid/ses-public-fixture',
      );
      assert.strictEqual(response.data.value, 42);
      return 'AxiosHeaders and transforms with a fixed in-memory adapter';
    },
  },
  {
    name: 'bn.js after lockdown',
    run: async () => {
      const { default: BN } = await import('bn.js');
      assert.strictEqual(
        new BN(255).toRed(BN.red('k256')).fromRed().toString(),
        '255',
      );
      assert.strictEqual(
        new BN('9007199254740993').add(new BN(2)).toString(),
        '9007199254740995',
      );
      return 'reduction context inheritance and integer precision';
    },
  },
  {
    name: 'elliptic after lockdown',
    run: async () => {
      const { ec: EC, eddsa: EdDSA } = await import('elliptic');
      const curve = new EC('secp256k1');
      const key = curve.keyFromPrivate('1');
      assert.strictEqual(
        key.getPublic().encodeCompressed('hex'),
        '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
      );
      const message = Buffer.alloc(32, 0x42);
      const signature = key.sign(message, { canonical: true });
      assert(key.verify(message, signature));
      assert(!key.verify(Buffer.alloc(32, 0x43), signature));
      const ed = new EdDSA('ed25519');
      const edKey = ed.keyFromSecret(
        '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
      );
      const edSignature = edKey.sign(Buffer.alloc(0));
      assert.strictEqual(
        edKey.getPublic('hex').toLowerCase(),
        'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
      );
      assert.strictEqual(
        edSignature.toHex().toLowerCase(),
        'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b',
      );
      assert(edKey.verify(Buffer.alloc(0), edSignature));
      assert(!edKey.verify(Buffer.from([1]), edSignature));
      return 'secp256k1 key vector, RFC 8032 Ed25519 vector, signatures and wrong-message rejection (public fixtures)';
    },
  },
  {
    name: 'inversify after lockdown',
    run: async () => {
      const descriptor = Object.getOwnPropertyDescriptor(
        Reflect,
        'getMetadata',
      );
      const { Container, injectable, inject } = await import('inversify');
      class Engine {
        go() {
          return 'vroom';
        }
      }
      class Car {
        constructor(public engine: Engine) {}
      }
      injectable()(Engine);
      inject(Engine)(Car, undefined, 0);
      injectable()(Car);
      const container = new Container();
      container.bind(Engine).toSelf();
      container.bind(Car).toSelf();
      assert.strictEqual(container.get(Car).engine.go(), 'vroom');
      if (Object.isFrozen(Reflect))
        assert.deepStrictEqual(
          Object.getOwnPropertyDescriptor(Reflect, 'getMetadata'),
          descriptor,
        );
      return 'dependency injection and unchanged Reflect metadata descriptor';
    },
  },
] as const;
