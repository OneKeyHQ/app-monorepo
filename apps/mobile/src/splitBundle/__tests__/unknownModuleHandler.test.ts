import { classifyUnknownModuleError } from '../unknownModuleHandler';

describe('classifyUnknownModuleError', () => {
  it('marks "Requiring unknown module 777" as a split-bundle integrity violation', () => {
    const err = new Error('Requiring unknown module "777"');
    const meta = classifyUnknownModuleError(err);
    expect(meta).toEqual({ kind: 'split_bundle_integrity', moduleId: '777' });
  });

  it('handles unquoted module id', () => {
    const err = new Error('Requiring unknown module 3904');
    expect(classifyUnknownModuleError(err)).toEqual({
      kind: 'split_bundle_integrity',
      moduleId: '3904',
    });
  });

  it('handles single-quoted module id', () => {
    const err = new Error("Requiring unknown module '791'");
    expect(classifyUnknownModuleError(err)).toEqual({
      kind: 'split_bundle_integrity',
      moduleId: '791',
    });
  });

  it('returns null for unrelated errors', () => {
    expect(classifyUnknownModuleError(new Error('boom'))).toBeNull();
  });

  it('returns null for non-Error inputs', () => {
    expect(classifyUnknownModuleError('Requiring unknown module 1')).toBeNull();
    expect(classifyUnknownModuleError(null)).toBeNull();
    expect(classifyUnknownModuleError(undefined)).toBeNull();
    expect(
      classifyUnknownModuleError({ message: 'Requiring unknown module 1' }),
    ).toBeNull();
  });

  it('returns null when message starts differently than the exact expected prefix', () => {
    expect(
      classifyUnknownModuleError(
        new Error('previously: Requiring unknown module 1'),
      ),
    ).toBeNull();
  });

  it('handles Hermes-style trailing period', () => {
    // Some RN/Hermes builds append a period after the id.
    expect(
      classifyUnknownModuleError(new Error('Requiring unknown module 777.')),
    ).toEqual({ kind: 'split_bundle_integrity', moduleId: '777' });
  });

  it('preserves leading zeros in module id (kept as captured string)', () => {
    expect(
      classifyUnknownModuleError(new Error('Requiring unknown module 007')),
    ).toEqual({ kind: 'split_bundle_integrity', moduleId: '007' });
  });

  it('rejects negative-id-style messages (Metro never emits these)', () => {
    expect(
      classifyUnknownModuleError(new Error('Requiring unknown module -3')),
    ).toBeNull();
  });

  it('handles very large module ids (kept as string, not parsed)', () => {
    expect(
      classifyUnknownModuleError(
        new Error('Requiring unknown module 999999999999999'),
      ),
    ).toEqual({ kind: 'split_bundle_integrity', moduleId: '999999999999999' });
  });
});
