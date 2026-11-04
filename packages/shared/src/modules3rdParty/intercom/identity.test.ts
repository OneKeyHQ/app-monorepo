import { getIntercomSessionToken } from './identity';

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

  it('stays anonymous without requesting a token', async () => {
    await expect(getIntercomSessionToken(null)).resolves.toBeUndefined();
    expect(mockApiGetCustomerJWT).not.toHaveBeenCalled();
  });

  it('aborts an anonymous session once a user has signed in', async () => {
    mockUserId = 'A';
    await expect(getIntercomSessionToken(null)).rejects.toThrow('user changed');
    expect(mockApiGetCustomerJWT).not.toHaveBeenCalled();
  });

  it('returns the token of the user who is still signed in', async () => {
    mockUserId = 'A';
    mockApiGetCustomerJWT.mockResolvedValue({ token: createToken('A') });
    await expect(getIntercomSessionToken('A')).resolves.toBe(createToken('A'));
  });

  it('aborts when the account changes while the token is requested', async () => {
    mockUserId = 'A';
    mockApiGetCustomerJWT.mockImplementation(async () => {
      mockUserId = 'B';
      return { token: createToken('A') };
    });
    await expect(getIntercomSessionToken('A')).rejects.toThrow('user changed');
  });
});
