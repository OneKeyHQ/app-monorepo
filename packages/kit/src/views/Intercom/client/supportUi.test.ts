import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EIntercomRoutes } from '@onekeyhq/shared/src/routes/intercom';

import { presentIntercomSupportUi } from './supportUi';

type IRoute = {
  name: string;
  params?: Record<string, unknown>;
  state?: { index?: number; routes: { name: string }[] };
};

const mockDispatch = jest.fn<void, [unknown]>();
const mockNavigate = jest.fn<void, [unknown]>();
const mockLogBranch = jest.fn<void, [unknown]>();
let mockReady = true;
let mockRoot: { key: string; index: number; routes: IRoute[] };
const mockNavigation = {
  isReady: () => mockReady,
  getRootState: () => mockRoot,
  dispatch: (action: unknown) => {
    mockDispatch(action);
  },
  navigate: (action: unknown) => {
    mockNavigate(action);
  },
};
let mockCurrent: typeof mockNavigation | null = mockNavigation;

jest.mock('@react-navigation/native', () => ({
  StackActions: {
    push: (name: string, params: unknown) => ({
      type: 'PUSH',
      payload: { name, params },
    }),
  },
}));
jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    get current() {
      return mockCurrent;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    notification: {
      support: {
        supportReplyBranch: (params: unknown) => {
          mockLogBranch(params);
        },
      },
    },
  },
}));

function stack(routes: IRoute[]) {
  mockRoot = { key: 'root-key', index: routes.length - 1, routes };
}
function modalParams(screen: EIntercomRoutes, params: unknown) {
  return {
    screen: EModalRoutes.IntercomModal,
    params: { screen, params },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReady = true;
  mockCurrent = mockNavigation;
  stack([{ name: ERootRoutes.Main }]);
});

it('reports navigation as unavailable until the root container is ready', () => {
  mockCurrent = null;
  expect(presentIntercomSupportUi({ userId: null })).toBe(false);
  mockCurrent = mockNavigation;
  mockReady = false;
  expect(presentIntercomSupportUi({ userId: null })).toBe(false);
  expect(mockDispatch).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockLogBranch).not.toHaveBeenCalled();
});

it('pushes support home on the root stack when support is not open', () => {
  const route = { userId: 'A', requestId: 'r1' };
  expect(presentIntercomSupportUi(route)).toBe(true);
  expect(mockDispatch).toHaveBeenCalledWith({
    type: 'PUSH',
    payload: {
      name: ERootRoutes.Modal,
      params: modalParams(EIntercomRoutes.Home, route),
    },
    target: 'root-key',
  });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockLogBranch).toHaveBeenCalledWith({
    conversationId: undefined,
    selectedBranch: 'rn-home',
  });
});

it('keeps another modal, such as a mandatory update, underneath a targeted conversation', () => {
  stack([
    { name: ERootRoutes.Main },
    {
      name: ERootRoutes.Modal,
      params: { screen: EModalRoutes.AppUpdateModal },
      state: { index: 0, routes: [{ name: EModalRoutes.AppUpdateModal }] },
    },
  ]);
  const route = { userId: null, conversationId: '42' };
  expect(presentIntercomSupportUi(route)).toBe(true);
  expect(mockDispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'PUSH',
      target: 'root-key',
      payload: {
        name: ERootRoutes.Modal,
        params: modalParams(EIntercomRoutes.Conversation, route),
      },
    }),
  );
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockLogBranch).toHaveBeenCalledWith({
    conversationId: '42',
    selectedBranch: 'rn-conversation',
  });
});

it.each([
  [
    'a mounted support stack',
    {
      params: { screen: EModalRoutes.IntercomModal },
      state: { index: 0, routes: [{ name: EModalRoutes.IntercomModal }] },
    },
  ],
  [
    'a support modal whose nested navigator has not mounted yet',
    { params: { screen: EModalRoutes.IntercomModal } },
  ],
])('retargets %s instead of stacking a duplicate support modal', (_, top) => {
  stack([{ name: ERootRoutes.Main }, { name: ERootRoutes.Modal, ...top }]);
  const route = { userId: 'A', conversationId: '7' };
  expect(presentIntercomSupportUi(route)).toBe(true);
  expect(mockNavigate).toHaveBeenCalledWith({
    name: ERootRoutes.Modal,
    params: modalParams(EIntercomRoutes.Conversation, route),
    pop: true,
  });
  expect(mockDispatch).not.toHaveBeenCalled();
});

it('reads the last route of a partial modal state as focused', () => {
  stack([
    { name: ERootRoutes.Main },
    {
      name: ERootRoutes.Modal,
      params: { screen: EModalRoutes.AppUpdateModal },
      state: {
        routes: [
          { name: EModalRoutes.IntercomModal },
          { name: EModalRoutes.AppUpdateModal },
        ],
      },
    },
  ]);
  expect(presentIntercomSupportUi({ userId: null })).toBe(true);
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(mockNavigate).not.toHaveBeenCalled();
});
