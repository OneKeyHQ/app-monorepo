import { EApproveType } from '../../types/staking';
import {
  MorphoBaseBundlerContract,
  MorphoBundlerContract,
  MorphoKatanaBundlerContract,
} from '../consts/addresses';

import earnUtils from './earnUtils';

import type {
  IEarnPermit2ApproveSignData,
  IStakeProtocolListItem,
} from '../../types/staking';

describe('Earn registered protocol selection', () => {
  const vault = '0xabcdef1234567890123456789012345678901234';
  const protocol = {
    network: { networkId: 'evm--56' },
    provider: { name: 'Unitas', vault },
  } as IStakeProtocolListItem;

  it('matches a registered EVM vault independent of address case', () => {
    expect(
      earnUtils.findEarnProtocol({
        protocols: [protocol],
        networkId: 'evm--56',
        providerName: 'unitas',
        protocolVault: vault.toUpperCase(),
      }),
    ).toBe(protocol);
  });

  it('rejects an unregistered vault and an ambiguous selection', () => {
    const params = { networkId: 'evm--56', providerName: 'unitas' };
    expect(
      earnUtils.findEarnProtocol({
        ...params,
        protocols: [protocol],
        protocolVault: '0xwrong',
      }),
    ).toBeUndefined();
    expect(
      earnUtils.findEarnProtocol({
        ...params,
        protocols: [
          protocol,
          { ...protocol, provider: { ...protocol.provider, vault: '0xother' } },
        ],
      }),
    ).toBeUndefined();
  });

  it('does not case-fold non-EVM vaults', () => {
    const solProtocol = {
      ...protocol,
      network: { ...protocol.network, networkId: 'sol--101' },
      provider: { ...protocol.provider, vault: 'Abc' },
    };
    expect(
      earnUtils.findEarnProtocol({
        protocols: [solProtocol],
        networkId: 'sol--101',
        providerName: 'unitas',
        protocolVault: 'abc',
      }),
    ).toBeUndefined();
  });
});

describe('Earn permit payload verification', () => {
  const owner = '0x1111111111111111111111111111111111111111';
  const token = {
    address: '0x2222222222222222222222222222222222222222',
    symbol: 'USDC',
    decimals: 6,
  };
  const data = (): IEarnPermit2ApproveSignData => ({
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: 1,
      verifyingContract: token.address,
    },
    primaryType: 'Permit',
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    message: {
      owner,
      spender: MorphoBundlerContract,
      value: '1250000',
      nonce: '0',
      deadline: String(Math.floor(Date.now() / 1000) + 3600),
    },
  });
  const check = (message = data(), networkId = 'evm--1') =>
    earnUtils.assertEarnPermit({
      providerName: 'Morpho',
      data: message,
      networkId,
      accountAddress: owner,
      token,
      amount: '1.25',
    });
  it.each([
    ['evm--1', MorphoBundlerContract],
    ['evm--8453', MorphoBaseBundlerContract],
    ['evm--747474', MorphoKatanaBundlerContract],
  ])('accepts the approved spender on %s', (networkId, spender) => {
    const payload = data();
    payload.domain.chainId = Number(networkId.split('--')[1]);
    payload.message.spender = spender;
    expect(() => check(payload, networkId)).not.toThrow();
  });
  it.each(['owner', 'spender', 'value', 'deadline'] as const)(
    'rejects changed %s',
    (field) => {
      const payload = data();
      payload.message[field] = '0';
      expect(() => check(payload)).toThrow();
    },
  );
  it.each(['EIP712Domain', 'Permit'] as const)(
    'rejects empty, incomplete, reordered, extended or retyped %s fields with unchanged values',
    (key) => {
      const payload = data();
      const fields = payload.types[key];
      for (const altered of [
        [],
        fields.filter(
          ({ name }) =>
            name !== (key === 'Permit' ? 'spender' : 'verifyingContract'),
        ),
        [...fields].toReversed(),
        [...fields, { name: 'extra', type: 'bytes32' }],
        [{ ...fields[0], type: 'bytes32' }, ...fields.slice(1)],
      ]) {
        payload.types[key] = altered;
        expect(() => check(payload)).toThrow(
          'Invalid Earn permit authorization',
        );
      }
    },
  );
  it('rejects another chain or token and unsupported networks', () => {
    const payload = data();
    payload.domain.chainId = 56;
    expect(() => check(payload)).toThrow();
    payload.domain.chainId = 1;
    payload.domain.verifyingContract = owner;
    expect(() => check(payload)).toThrow();
    expect(() => check(data(), 'evm--56')).toThrow();
    expect(
      earnUtils.resolveEarnAllowanceSpenderAddress({
        providerName: 'Morpho',
        networkId: 'evm--56',
        approveType: EApproveType.Permit,
        approveSpenderAddress: owner,
      }),
    ).toBe('');
  });
  it('accepts DAI holder/allowed and rejects a different holder', () => {
    const payload = data();
    payload.message = {
      holder: owner,
      allowed: true,
      spender: MorphoBundlerContract,
      expiry: payload.message.deadline,
      nonce: '0',
    };
    const checkDai = () =>
      earnUtils.assertEarnPermit({
        providerName: 'Morpho',
        data: payload,
        networkId: 'evm--1',
        accountAddress: owner,
        token: { ...token, symbol: 'DAI', decimals: 18 },
        amount: '1',
      });
    expect(checkDai).toThrow('Invalid Earn permit authorization');
    payload.types.Permit = [
      { name: 'holder', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
      { name: 'allowed', type: 'bool' },
    ];
    expect(checkDai).not.toThrow();
    payload.message.holder = token.address;
    expect(checkDai).toThrow();
  });
});
