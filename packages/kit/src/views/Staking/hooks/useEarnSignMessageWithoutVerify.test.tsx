/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { useEarnSignMessageWithoutVerify } from './useEarnSignMessageWithoutVerify';

const mockAccount = jest.fn<Promise<{ address: string }>, [unknown]>();
const mockBuild = jest.fn<Promise<{ message: string }>, [unknown]>();
const mockSign = jest.fn<Promise<string>, [unknown]>();
const mockApiAddress = jest.fn<Promise<string>, [unknown]>();
jest.mock('@onekeyhq/shared/src/utils/messageUtils', () => ({
  autoFixPersonalSignMessage: ({ message }: { message: string }) => message,
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccount: (params: unknown) => mockAccount(params),
      getAccountAddressForApi: (params: unknown) => mockApiAddress(params),
    },
    serviceStaking: {
      buildRegisterSignMessageData: (params: unknown) => mockBuild(params),
    },
    serviceDApp: {
      openSignMessageModal: (params: unknown) => mockSign(params),
    },
  },
}));

it('rejects a transient different account before requesting a provider message', async () => {
  const a = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  mockAccount
    .mockResolvedValueOnce({ address: a })
    .mockResolvedValueOnce({
      address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    })
    .mockResolvedValueOnce({ address: a });
  expect((await mockAccount({})).address).toBe(a);
  const { result } = renderHook(() => useEarnSignMessageWithoutVerify());
  await expect(
    result.current({
      accountId: 'account',
      networkId: 'evm--1',
      provider: 'stakefish',
      symbol: 'ETH',
      action: 'stake',
      amount: '1',
      expectedAccountAddress: a,
    }),
  ).rejects.toThrow('Task account changed before signing');
  expect((await mockAccount({})).address).toBe(a);
  expect(mockBuild).not.toHaveBeenCalled();
  expect(mockSign).not.toHaveBeenCalled();
});

it('rechecks the frozen owner after requesting the message and before opening signature', async () => {
  const a = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  mockAccount.mockReset().mockResolvedValue({ address: a });
  mockApiAddress
    .mockReset()
    .mockResolvedValue('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  mockBuild.mockReset().mockResolvedValue({ message: 'message' });
  mockSign.mockClear();
  const { result } = renderHook(() => useEarnSignMessageWithoutVerify());
  await expect(
    result.current({
      accountId: 'account',
      networkId: 'evm--1',
      provider: 'stakefish',
      symbol: 'ETH',
      action: 'stake',
      amount: '1',
      expectedAccountAddress: a,
    }),
  ).rejects.toThrow('Task account changed before signing');
  expect(mockBuild).toHaveBeenCalledTimes(1);
  expect(mockSign).not.toHaveBeenCalled();
});

it('does not open a signing dialog if the withdrawal intent changes during message construction', async () => {
  const address = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  mockAccount.mockReset().mockResolvedValue({ address });
  mockApiAddress.mockReset().mockResolvedValue(address);
  let resolveMessage: (value: { message: string }) => void = () => undefined;
  const pending = new Promise<{ message: string }>((resolve) => {
    resolveMessage = resolve;
  });
  mockBuild.mockReset().mockReturnValue(pending);
  mockSign.mockClear();
  let current = true;
  const { result } = renderHook(() => useEarnSignMessageWithoutVerify());
  const operation = result.current({
    accountId: 'account',
    networkId: 'evm--1',
    provider: 'stakefish',
    symbol: 'ETH',
    action: 'unstake',
    identity: 'validator',
    expectedAccountAddress: address,
    isCurrent: () => current,
  });
  await Promise.resolve();
  current = false;
  resolveMessage({ message: 'message' });
  await expect(operation).rejects.toThrow('Task intent changed before signing');
  expect(mockSign).not.toHaveBeenCalled();
});
