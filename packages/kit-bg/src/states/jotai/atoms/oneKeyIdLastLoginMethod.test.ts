import { persistOneKeyIdLastLoginMethod } from './oneKeyIdLastLoginMethod';
import { oneKeyIdLastLoginMethodPersistAtom } from './prime';

jest.mock('./prime', () => ({
  oneKeyIdLastLoginMethodPersistAtom: {
    set: jest.fn(),
  },
}));

const mockSet = oneKeyIdLastLoginMethodPersistAtom.set as jest.Mock;

describe('persistOneKeyIdLastLoginMethod', () => {
  beforeEach(() => {
    mockSet.mockReset();
    mockSet.mockResolvedValue(undefined);
  });

  it.each(['email', 'google', 'apple'] as const)(
    'writes %s after a successful login',
    async (method) => {
      await expect(persistOneKeyIdLastLoginMethod(method)).resolves.toBe(true);
      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith({ method });
    },
  );

  it.each([undefined, null, '', 'oauth', 'wallet'])(
    'does not write invalid value %p',
    async (method) => {
      await expect(persistOneKeyIdLastLoginMethod(method)).resolves.toBe(false);
      expect(mockSet).not.toHaveBeenCalled();
    },
  );

  it('does not throw when storage write fails', async () => {
    mockSet.mockRejectedValueOnce(new Error('persist failed'));

    await expect(persistOneKeyIdLastLoginMethod('email')).resolves.toBe(false);
    expect(mockSet).toHaveBeenCalledWith({ method: 'email' });
  });
});
