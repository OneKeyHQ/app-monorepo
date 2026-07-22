import { formatSearchedDevice } from '../commands/device/device-search';

describe('device search formatting', () => {
  it('prefers the canonical display name over the transport name', () => {
    expect(
      formatSearchedDevice({
        connectId: 'PRO2_USB',
        name: 'Pro2 6136',
        displayName: 'My Pro 2',
        deviceType: 'pro2',
      }),
    ).toMatchObject({
      name: 'My Pro 2',
      model: 'pro2',
    });
  });
});
