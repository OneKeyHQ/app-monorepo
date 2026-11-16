import { utils } from 'ethers';

import {
  EtherFiLiquidReferContract,
  EthereumWETH,
  EthereumWeETH,
} from '@onekeyhq/shared/src/consts/addresses';

import {
  assertEtherFiStakeTransaction,
  assertEtherFiWithdrawTransaction,
  normalizeEtherFiAmount,
} from './etherFiTransactionValidation';

const account = '0x1111111111111111111111111111111111111111';
const vault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const queue = '0x0d2df071207e18ca8638b4f04e98c53155ec2ce0';
const teller = '0x9aa79c84b79816ab920bbce20f8f74557b514734';
const deposit = new utils.Interface([
  'function deposit(address teller,address depositAsset,uint256 depositAmount,uint256 minimumMint,address referrer)',
]);
const queueContract = new utils.Interface([
  'function requestOnChainWithdraw(address assetOut,uint128 amountOfShares,uint16 discount,uint24 secondsToDeadline)',
  'function cancelOnChainWithdraw((uint96 nonce,address user,address assetOut,uint128 amountOfShares,uint128 amountOfAssets,uint40 creationTime,uint24 secondsToMaturity,uint24 secondsToDeadline) request)',
]);
const stakeParams = {
  networkId: 'evm--1',
  vault,
  accountAddress: account,
  symbol: 'WETH',
  amount: '0.1',
  inputTokenAddress: EthereumWETH,
  stakeType: 'normal' as const,
};
const tx = {
  from: account,
  to: EtherFiLiquidReferContract,
  value: '0x0',
  chainId: 1,
  data: deposit.encodeFunctionData('deposit', [
    teller,
    EthereumWETH,
    utils.parseUnits('0.1', 18),
    1,
    account,
  ]),
};

describe('EtherFi transaction binding', () => {
  it('normalizes a leading decimal point without changing precision', () => {
    expect(normalizeEtherFiAmount('.000000000000000001')).toBe(
      '0.000000000000000001',
    );
    expect(normalizeEtherFiAmount('.000001')).toBe('0.000001');
    expect(normalizeEtherFiAmount('.00000001')).toBe('0.00000001');
    expect(normalizeEtherFiAmount('0.5')).toBe('0.5');
    expect(normalizeEtherFiAmount('1.')).toBe('1');
    expect(normalizeEtherFiAmount('0.')).toBe('0');
    expect(normalizeEtherFiAmount('0')).toBe('0');
    expect(normalizeEtherFiAmount('.')).toBe('.');
  });

  it('accepts the selected vault, asset and amount and rejects a changed transaction', () => {
    expect(() =>
      assertEtherFiStakeTransaction({ ...stakeParams, tx }),
    ).not.toThrow();
    expect(() =>
      assertEtherFiStakeTransaction({
        ...stakeParams,
        tx: { ...tx, to: account },
      }),
    ).toThrow();
    expect(() =>
      assertEtherFiStakeTransaction({
        ...stakeParams,
        tx: { ...tx, from: teller },
      }),
    ).toThrow();
    expect(() =>
      assertEtherFiStakeTransaction({
        ...stakeParams,
        tx: { ...tx, value: '0x1' },
      }),
    ).toThrow();
    expect(() =>
      assertEtherFiStakeTransaction({ ...stakeParams, amount: '0.2', tx }),
    ).toThrow();
    expect(() =>
      assertEtherFiStakeTransaction({
        ...stakeParams,
        tx: { ...tx, chainId: 10 },
      }),
    ).toThrow();
    expect(() =>
      assertEtherFiStakeTransaction({
        ...stakeParams,
        tx: {
          ...tx,
          data: deposit.encodeFunctionData('deposit', [
            account,
            EthereumWETH,
            utils.parseUnits('0.1', 18),
            1,
            account,
          ]),
        },
      }),
    ).toThrow();
  });

  it('binds wrap target and native value', () => {
    const wrap = {
      from: account,
      to: EthereumWETH,
      data: '0xd0e30db0',
      value: utils.parseUnits('0.1', 18).toHexString(),
    };
    const request = {
      ...stakeParams,
      symbol: 'ETH',
      inputTokenAddress: '',
      stakeType: 'wrap' as const,
      tx: wrap,
    };
    expect(() => assertEtherFiStakeTransaction(request)).not.toThrow();
    expect(() =>
      assertEtherFiStakeTransaction({
        ...request,
        tx: { ...wrap, data: '0x' },
      }),
    ).toThrow();
    expect(() =>
      assertEtherFiStakeTransaction({ ...request, amount: '0.2' }),
    ).toThrow();
  });

  it('binds queued withdrawal output and share amount', () => {
    const data = queueContract.encodeFunctionData('requestOnChainWithdraw', [
      EthereumWeETH,
      utils.parseUnits('1', 18),
      0,
      1_209_600,
    ]);
    const request = {
      tx: { from: account, to: queue, value: '0x0', data },
      networkId: 'evm--1',
      vault,
      accountAddress: account,
      amount: '1',
      outputTokenAddress: EthereumWeETH,
      withdrawType: 'queued' as const,
    };
    expect(() => assertEtherFiWithdrawTransaction(request)).not.toThrow();
    expect(() =>
      assertEtherFiWithdrawTransaction({ ...request, amount: '2' }),
    ).toThrow();
    expect(() =>
      assertEtherFiWithdrawTransaction({
        ...request,
        outputTokenAddress: EthereumWETH,
      }),
    ).toThrow();
    expect(() =>
      assertEtherFiWithdrawTransaction({
        ...request,
        tx: {
          ...request.tx,
          data: queueContract.encodeFunctionData('requestOnChainWithdraw', [
            EthereumWeETH,
            utils.parseUnits('1', 18),
            1,
            1_209_600,
          ]),
        },
      }),
    ).toThrow();
  });

  it('binds cancellation to the selected request identity and owner', () => {
    const tuple = [1, account, EthereumWeETH, 1, 1, 1, 1, 1];
    const tupleType =
      'tuple(uint96 nonce,address user,address assetOut,uint128 amountOfShares,uint128 amountOfAssets,uint40 creationTime,uint24 secondsToMaturity,uint24 secondsToDeadline)';
    const identity = utils.keccak256(
      utils.defaultAbiCoder.encode([tupleType], [tuple]),
    );
    const data = queueContract.encodeFunctionData('cancelOnChainWithdraw', [
      tuple,
    ]);
    const request = {
      tx: { from: account, to: queue, value: '0x0', data },
      networkId: 'evm--1',
      vault,
      accountAddress: account,
      amount: '0',
      withdrawType: 'cancel' as const,
      identity,
    };
    expect(() => assertEtherFiWithdrawTransaction(request)).not.toThrow();
    expect(() =>
      assertEtherFiWithdrawTransaction({
        ...request,
        identity: `0x${'00'.repeat(32)}`,
      }),
    ).toThrow();
    expect(() =>
      assertEtherFiWithdrawTransaction({ ...request, accountAddress: teller }),
    ).toThrow();
  });

  it('accepts the published queue event request identity', () => {
    const owner = '0xf67b153b536f47a6e04cb8779e689f6a3b89e5c7';
    const tuple = [
      3039,
      owner,
      EthereumWeETH,
      '20000000000000',
      '20043681664350',
      1_792_379_327,
      3600,
      1_209_600,
    ];
    const data = queueContract.encodeFunctionData('cancelOnChainWithdraw', [
      tuple,
    ]);
    expect(() =>
      assertEtherFiWithdrawTransaction({
        tx: { from: owner, to: queue, value: '0x0', data },
        networkId: 'evm--1',
        vault,
        accountAddress: owner,
        amount: '0',
        withdrawType: 'cancel',
        identity:
          '0x14e5511f491565d7e10ab19a35c7ce3e61a243245ec4573c341298d775d5833d',
      }),
    ).not.toThrow();
  });
});
