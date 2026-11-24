/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { EarnStakeForm } from './Stake';
import { EarnWithdrawForm } from './Withdraw';

const mockGuard = jest.fn((_params: unknown) => ({
  loading: false,
  blocked: false,
  verifyBeforeAction: jest.fn().mockResolvedValue(true),
}));
const mockStake = jest.fn((_props: unknown) => null);
const mockWithdraw = jest.fn((_props: unknown) => null);

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Alert: () => null,
}));

jest.mock('../../hooks/useEtherFiLegacyActionGuard', () => ({
  useEtherFiLegacyActionGuard: (params: unknown) => mockGuard(params),
}));
jest.mock('../UniversalStake', () => ({
  UniversalStake: (props: unknown) => mockStake(props),
}));
jest.mock('../UniversalWithdraw', () => ({
  UniversalWithdraw: (props: unknown) => mockWithdraw(props),
}));

describe('Earn protocol forms', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not mount the EtherFi guard for another provider', () => {
    render(
      <EarnStakeForm
        accountId="account"
        networkId="evm--1"
        balance="1"
        providerName="morpho"
        approveTarget={{
          accountId: 'account',
          networkId: 'evm--1',
          spenderAddress: 'spender',
        }}
      />,
    );
    expect(mockGuard).not.toHaveBeenCalled();
    expect(mockStake).toHaveBeenCalledWith(
      expect.not.objectContaining({ actionGuard: expect.anything() }),
    );
    expect(mockStake).toHaveBeenCalledWith(
      expect.not.objectContaining({ preparationPolicy: expect.anything() }),
    );
  });

  it('applies the setup quote policy only to EtherFi deposits', () => {
    render(
      <EarnStakeForm
        accountId="account"
        networkId="evm--1"
        balance="1"
        providerName="etherfi"
        approveTarget={{
          accountId: 'account',
          networkId: 'evm--1',
          spenderAddress: 'spender',
        }}
      />,
    );
    expect(mockStake).toHaveBeenCalledWith(
      expect.objectContaining({
        actionGuard: expect.anything(),
        preparationPolicy: 'confirm-setup-before-deposit',
      }),
    );
  });

  it('scopes the EtherFi withdrawal guard and skips it for cancellation', () => {
    render(
      <EarnWithdrawForm
        accountId="account"
        networkId="evm--1"
        providerName="etherfi"
        protocolVault="vault"
        initialWithdrawType="cancel"
        accountAddress="address"
        balance="1"
        price="1"
      />,
    );
    expect(mockGuard).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account',
        accountAddress: 'address',
        networkId: 'evm--1',
        vault: 'vault',
        skip: true,
      }),
    );
    expect(mockWithdraw).toHaveBeenCalledWith(
      expect.objectContaining({
        actionGuard: expect.anything(),
        withdrawalSafetyPolicy: 'confirm-and-revalidate',
        maxWithdrawAmountMode: 'fixed',
        isDisabled: false,
      }),
    );
  });

  it('does not enable the EtherFi withdrawal policy for another provider', () => {
    render(
      <EarnWithdrawForm
        accountId="account"
        networkId="evm--1"
        providerName="morpho"
        accountAddress="address"
        balance="1"
        price="1"
      />,
    );
    expect(mockWithdraw).toHaveBeenCalledWith(
      expect.not.objectContaining({
        withdrawalSafetyPolicy: expect.anything(),
        maxWithdrawAmountMode: expect.anything(),
      }),
    );
  });

  it.each([
    [
      'ETH',
      '0xf0bb20865277abd641a307ece5ee04e79073416c',
      '0x0d2df071207e18ca8638b4f04e98c53155ec2ce0',
      18,
    ],
    [
      'USD',
      '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c',
      '0x38fc1ba73b7ed289955a07d9f11a85b6e388064a',
      6,
    ],
    [
      'BTC',
      '0x5f46d540b6ed704c3c8789105f30e075aa900726',
      '0x77a2fd42f8769d8063f2e75061fc200014e41edf',
      8,
    ],
  ])(
    'allows only the %s vault queue as the share approval target',
    (_name, vault, queue, decimals) => {
      const approveTarget = {
        accountId: 'account',
        networkId: 'evm--1',
        spenderAddress: queue,
        token: {
          address: vault,
          symbol: 'shares',
          name: 'shares',
          decimals,
          isNative: false,
        },
      };
      const props = {
        accountId: 'account',
        networkId: 'evm--1',
        providerName: 'etherfi',
        protocolVault: vault,
        accountAddress: 'address',
        balance: '1',
        price: '1',
        approveTarget,
      };
      const { rerender } = render(<EarnWithdrawForm {...props} />);
      expect(mockWithdraw).toHaveBeenLastCalledWith(
        expect.not.objectContaining({ isDisabled: true }),
      );
      rerender(
        <EarnWithdrawForm
          {...props}
          approveTarget={{
            ...approveTarget,
            spenderAddress: '0x1111111111111111111111111111111111111111',
          }}
        />,
      );
      expect(mockWithdraw).toHaveBeenLastCalledWith(
        expect.objectContaining({ isDisabled: true }),
      );
    },
  );

  it('rejects a mismatched network, account, share token, and unknown vault', () => {
    const vault = '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c';
    const approveTarget = {
      accountId: 'account',
      networkId: 'evm--1',
      spenderAddress: '0x38fc1ba73b7ed289955a07d9f11a85b6e388064a',
      token: {
        address: vault,
        symbol: 'shares',
        name: 'shares',
        decimals: 6,
        isNative: false,
      },
    };
    const props = {
      accountId: 'account',
      networkId: 'evm--1',
      providerName: 'etherfi',
      protocolVault: vault,
      accountAddress: 'address',
      balance: '1',
      price: '1',
      approveTarget,
    };
    const { rerender } = render(<EarnWithdrawForm {...props} />);
    for (const changed of [
      { networkId: 'evm--10' },
      { protocolVault: '0x1111111111111111111111111111111111111111' },
      { approveTarget: { ...approveTarget, accountId: 'other' } },
      {
        approveTarget: {
          ...approveTarget,
          token: {
            ...approveTarget.token,
            address: '0x1111111111111111111111111111111111111111',
          },
        },
      },
      {
        approveTarget: {
          ...approveTarget,
          token: { ...approveTarget.token, decimals: 18 },
        },
      },
      {
        approveTarget: {
          ...approveTarget,
          token: { ...approveTarget.token, isNative: true },
        },
      },
    ]) {
      rerender(<EarnWithdrawForm {...props} {...changed} />);
      expect(mockWithdraw).toHaveBeenLastCalledWith(
        expect.objectContaining({ isDisabled: true }),
      );
    }
  });

  it('shows an error when the loaded protocol is missing approval data even if the parent disabled the form', () => {
    render(
      <EarnWithdrawForm
        accountId="account"
        networkId="evm--1"
        providerName="etherfi"
        protocolVault="0x08c6f91e2b681faf5e17227f2a44c307b3c1364c"
        protocolInfo={{
          provider: 'etherfi',
          networkId: 'evm--1',
          symbol: 'USDC',
          vault: '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c',
          stakeTag: '',
          providerDetail: { name: 'EtherFi', logoURI: '' },
        }}
        accountAddress="address"
        balance="0"
        price="0"
        isDisabled
      />,
    );
    expect(mockWithdraw).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isDisabled: true,
        beforeFooter: expect.anything(),
      }),
    );
  });
});
