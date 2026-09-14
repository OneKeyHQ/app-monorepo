import type { IFirmwareArtifactSelfTestState } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/FirmwareArtifactSelfTest';

import { createFirmwareArtifactGalleryClient } from './FirmwareArtifactGalleryClient';

describe('FirmwareArtifactGalleryClient', () => {
  it('passes the dev-only password to start and state requests', async () => {
    const state = {} as IFirmwareArtifactSelfTestState;
    const startFirmwareArtifactSelfTest = jest.fn().mockResolvedValue(state);
    const getFirmwareArtifactSelfTestState = jest.fn().mockResolvedValue(state);
    const client = createFirmwareArtifactGalleryClient(
      {
        startFirmwareArtifactSelfTest,
        getFirmwareArtifactSelfTestState,
      },
      { $$devOnlyPassword: 'dev-password' },
    );

    await client.start('pro-firmware');
    await client.getState();

    expect(startFirmwareArtifactSelfTest).toHaveBeenCalledWith({
      $$devOnlyPassword: 'dev-password',
      scenario: 'pro-firmware',
    });
    expect(getFirmwareArtifactSelfTestState).toHaveBeenCalledWith({
      $$devOnlyPassword: 'dev-password',
    });
  });
});
