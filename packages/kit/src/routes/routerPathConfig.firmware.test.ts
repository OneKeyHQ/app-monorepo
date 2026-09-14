import {
  EModalFirmwareUpdateRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import { modalRouterPathConfig } from './routerPathConfig';

describe('firmware update extension cold-start route', () => {
  it('exposes the changelog without exposing install routes', () => {
    expect(
      modalRouterPathConfig
        .find((route) => route.name === EModalRoutes.FirmwareUpdateModal)
        ?.children?.map((route) => route.name),
    ).toEqual([EModalFirmwareUpdateRoutes.ChangeLog]);
  });
});
