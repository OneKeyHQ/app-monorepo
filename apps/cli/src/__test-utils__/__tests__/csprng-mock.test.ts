import {
  createDeterministicCsprng,
  createSequenceCsprng,
} from '../csprng-mock';

describe('csprng-mock', () => {
  it('returns deterministic bytes for the same seed', () => {
    const left = createDeterministicCsprng('seed');
    const right = createDeterministicCsprng('seed');

    expect(left(32)).toEqual(right(32));
  });

  it('separates output streams by seed', () => {
    const left = createDeterministicCsprng('seed-a');
    const right = createDeterministicCsprng('seed-b');

    expect(left(32)).not.toEqual(right(32));
  });

  it('supports injected sequence chunks', () => {
    const csprng = createSequenceCsprng([
      Buffer.from('aaaa', 'hex'),
      Buffer.from('bbbb', 'hex'),
    ]);

    expect(csprng(2)).toEqual(Buffer.from('aaaa', 'hex'));
    expect(csprng(2)).toEqual(Buffer.from('bbbb', 'hex'));
    expect(() => csprng(2)).toThrow('CSPRNG sequence exhausted');
  });
});
