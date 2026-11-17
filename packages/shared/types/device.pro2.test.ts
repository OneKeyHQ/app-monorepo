import { PRO2_FIRMWARE_UPDATE_TARGETS } from './device';

describe('Pro 2 firmware targets', () => {
  it('exposes every App-supported Pro 2 update target', () => {
    expect(PRO2_FIRMWARE_UPDATE_TARGETS).toEqual([
      'boot',
      'app_v1',
      'app_v2',
      'coprocessor',
      'resource',
      'se01',
      'se02',
      'se03',
      'se04',
    ]);
  });

  it('keeps romloader outside the normal firmware update flow', () => {
    expect(PRO2_FIRMWARE_UPDATE_TARGETS).not.toContain('romloader');
  });
});
