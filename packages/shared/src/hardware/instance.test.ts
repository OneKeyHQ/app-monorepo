import { getFirmwareManifestConnectSettings } from './instance';

describe('getFirmwareManifestConnectSettings', () => {
  it('uses external-only manifests on Native and Desktop clients', () => {
    expect(getFirmwareManifestConnectSettings(true)).toEqual({
      firmwareManifestMode: {
        kind: 'external-only',
      },
    });
  });

  it('preserves SDK-managed manifests for Web and Extension', () => {
    expect(getFirmwareManifestConnectSettings(false)).toEqual({
      fetchConfig: true,
    });
  });
});
