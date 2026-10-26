/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  const passthrough =
    () => (_target: unknown, _key?: string, descriptor?: PropertyDescriptor) =>
      descriptor;
  return {
    ...actual,
    backgroundClass: passthrough,
    backgroundMethod: passthrough,
  };
});

const ServiceAccountProfile = require('./ServiceAccountProfile')
  .default as typeof import('./ServiceAccountProfile').default;

it('never sends a withholding chain address to the badge endpoint', async () => {
  const get = jest.fn(async () => ({ data: { data: {} } }));
  const service = Object.assign(
    Object.create(ServiceAccountProfile.prototype) as InstanceType<
      typeof ServiceAccountProfile
    >,
    {
      getClient: async () => ({ get }),
      backgroundApi: {
        serviceNetwork: { isCustomNetwork: async () => false },
      },
    },
  );

  const result = await service.getAddressAccountBadge({
    networkId: 'xmr--0',
    fromAddress: '4own',
    toAddress: '4recipient',
    checkInteraction: true,
  });

  expect(get).not.toHaveBeenCalled();
  expect(result.isContract).toBeFalsy();
});
