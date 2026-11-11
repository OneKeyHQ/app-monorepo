import {
  assertIntercomIdentity,
  getCurrentIntercomUserId,
  getIntercomCredentials,
} from './identity';

let mockReady = Promise.resolve();
let mockUser: { isLoggedIn: boolean; onekeyUserId?: string } = {
  isLoggedIn: false,
};
let mockBackgroundUser: typeof mockUser = { isLoggedIn: false };
const mockToken = jest.fn<Promise<{ token: string }>, []>();
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  primePersistAtom: { atom: () => 'prime', ready: () => mockReady },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore', () => ({
  jotaiDefaultStore: { get: () => mockUser },
}));
jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: {
    $backgroundApiProxy: {
      servicePrime: {
        apiGetCustomerJWT: () => mockToken(),
        getLocalUserInfo: async () => mockBackgroundUser,
      },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
function token(user: string) {
  return `header.${Buffer.from(JSON.stringify({ user_id: user })).toString('base64url')}.signature`;
}
beforeEach(() => {
  mockReady = Promise.resolve();
  mockUser = { isLoggedIn: false };
  mockBackgroundUser = { isLoggedIn: false };
  mockToken.mockReset();
});
it('reads anonymous and verified identities from the current runtime atom without an RPC', async () => {
  await expect(getCurrentIntercomUserId()).resolves.toBeNull();
  mockUser = { isLoggedIn: true, onekeyUserId: 'A' };
  await expect(getCurrentIntercomUserId()).resolves.toBe('A');
  expect(mockToken).not.toHaveBeenCalled();
});
it('rejects a signed-in state without a verified OneKey id', async () => {
  mockUser = { isLoggedIn: true };
  await expect(getCurrentIntercomUserId()).rejects.toThrow(
    'verified OneKey ID',
  );
});
it('returns the token only while its requesting account remains current', async () => {
  mockUser = { isLoggedIn: true, onekeyUserId: 'A' };
  mockBackgroundUser = mockUser;
  mockToken.mockResolvedValue({ token: token('intercom-A') });
  await expect(getIntercomCredentials('A')).resolves.toMatchObject({
    token: token('intercom-A'),
  });
  mockToken.mockImplementation(async () => {
    mockUser = { isLoggedIn: true, onekeyUserId: 'B' };
    return { token: token('intercom-A') };
  });
  await expect(getIntercomCredentials('A')).resolves.toBeUndefined();
});
it('rejects missing identity claims instead of falling back to an anonymous visitor', async () => {
  mockUser = { isLoggedIn: true, onekeyUserId: 'A' };
  mockBackgroundUser = mockUser;
  mockToken.mockResolvedValue({ token: '' });
  await expect(getIntercomCredentials('A')).rejects.toThrow(
    'identity token is unavailable',
  );
});

it('waits for persisted identity before deciding that a session is anonymous', async () => {
  let release!: () => void;
  mockReady = new Promise<void>((resolve) => {
    release = resolve;
  });
  const identity = getCurrentIntercomUserId();
  mockUser = { isLoggedIn: true, onekeyUserId: 'loaded-user' };
  release();
  await expect(identity).resolves.toBe('loaded-user');
});

it('checks the authoritative background identity before a window changes shared visitor ownership', async () => {
  await expect(assertIntercomIdentity(null)).resolves.toBeUndefined();
  mockUser = { isLoggedIn: true, onekeyUserId: 'A' };
  await expect(assertIntercomIdentity('A')).rejects.toThrow(
    'Support session changed',
  );
  mockBackgroundUser = { isLoggedIn: true, onekeyUserId: 'A' };
  await expect(assertIntercomIdentity('A')).resolves.toBeUndefined();
  mockUser = { isLoggedIn: false };
  await expect(assertIntercomIdentity(null)).rejects.toThrow(
    'Support session changed',
  );
  expect(mockToken).not.toHaveBeenCalled();
});

it('rejects a JWT when background switches accounts before the window receives its atom update', async () => {
  mockUser = { isLoggedIn: true, onekeyUserId: 'A' };
  mockBackgroundUser = { isLoggedIn: true, onekeyUserId: 'B' };
  mockToken.mockResolvedValue({ token: token('intercom-B') });
  await expect(getIntercomCredentials('A')).rejects.toThrow(
    'Support session changed',
  );
});
