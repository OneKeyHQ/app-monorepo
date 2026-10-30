import { getCurrentIntercomToken } from './identity';

let mockUserId: string | null = null;
const mockApiGetCustomerJWT = jest.fn<Promise<{ token: string }>, []>();

jest.mock('../../appGlobals', () => ({
  __esModule: true,
  default: {
    $backgroundApiProxy: {
      servicePrime: {
        getLocalUserInfo: async () => ({
          isLoggedIn: mockUserId !== null,
          onekeyUserId: mockUserId,
        }),
        apiGetCustomerJWT: () => mockApiGetCustomerJWT(),
      },
    },
  },
}));
jest.mock('../../errors', () => ({ OneKeyLocalError: Error }));

function createToken(userId: string) {
  return `header.${Buffer.from(JSON.stringify({ user_id: userId })).toString(
    'base64url',
  )}.signature`;
}

describe('fallback Intercom identity', () => {
  beforeEach(() => {
    mockUserId = null;
    mockApiGetCustomerJWT.mockReset();
  });

  it('opens anonymously without requesting a token', async () => {
    await expect(getCurrentIntercomToken()).resolves.toBeUndefined();
    expect(mockApiGetCustomerJWT).not.toHaveBeenCalled();
  });

  it('returns the token of the user who is still signed in', async () => {
    mockUserId = 'A';
    mockApiGetCustomerJWT.mockResolvedValue({ token: createToken('A') });
    await expect(getCurrentIntercomToken()).resolves.toBe(createToken('A'));
  });

  it('aborts when the account changes while the token is requested', async () => {
    mockUserId = 'A';
    mockApiGetCustomerJWT.mockImplementation(async () => {
      mockUserId = 'B';
      return { token: createToken('A') };
    });
    await expect(getCurrentIntercomToken()).rejects.toThrow('user changed');
  });
});
