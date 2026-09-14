import { resumeUnifoldDepositTracking } from './resumeUnifoldDepositTracking';

type ITrackingState = {
  items: unknown[];
  watches?: unknown[];
  pendingDeliveries?: unknown[];
};

type IResumeBackgroundApi = Parameters<typeof resumeUnifoldDepositTracking>[0];

let mockTrackingState: ITrackingState;

jest.mock('../../states/jotai/atoms', () => ({
  perpsUnifoldDepositTrackingAtom: {
    get: async () => mockTrackingState,
  },
}));

function createBackgroundApi() {
  const unifoldDepositTrackingLoop = jest.fn(async () => undefined);
  const getService = jest.fn(() => ({
    unifoldDepositTrackingLoop,
  }));
  const backgroundApi = {};
  Object.defineProperty(backgroundApi, 'serviceUnifoldDeposit', {
    get: getService,
  });
  return {
    backgroundApi,
    getService,
    unifoldDepositTrackingLoop,
  };
}

describe('resumeUnifoldDepositTracking', () => {
  beforeEach(() => {
    mockTrackingState = {
      items: [],
      watches: [],
      pendingDeliveries: [],
    };
  });

  test('does not load the service when no persisted work remains', async () => {
    const { backgroundApi, getService, unifoldDepositTrackingLoop } =
      createBackgroundApi();

    await resumeUnifoldDepositTracking(
      backgroundApi as unknown as IResumeBackgroundApi,
    );

    expect(getService).not.toHaveBeenCalled();
    expect(unifoldDepositTrackingLoop).not.toHaveBeenCalled();
  });

  test.each([
    ['tracked execution', { items: [{}] }],
    ['recipient watch', { items: [], watches: [{}] }],
    ['pending terminal delivery', { items: [], pendingDeliveries: [{}] }],
  ])('resumes the service for a persisted %s', async (_label, state) => {
    mockTrackingState = state;
    const { backgroundApi, getService, unifoldDepositTrackingLoop } =
      createBackgroundApi();

    await resumeUnifoldDepositTracking(
      backgroundApi as unknown as IResumeBackgroundApi,
    );

    expect(getService).toHaveBeenCalledTimes(1);
    expect(unifoldDepositTrackingLoop).toHaveBeenCalledTimes(1);
  });
});
