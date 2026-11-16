import { utils } from 'ethers';

import {
  EtherFiLiquidReferContract,
  EthereumWETH,
} from '@onekeyhq/shared/src/consts/addresses';

import { classifyEtherFiRecoveryTransaction } from './etherFiRecoveryTransaction';

const account = '0x1111111111111111111111111111111111111111';
const vault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const txid = `0x${'a'.repeat(64)}`;
const blockHash = `0x${'b'.repeat(64)}`;
const args = {
  networkId: 'evm--1',
  accountAddress: account,
  vault,
  amount: '0.1',
  txid,
};
const wrap = {
  hash: txid,
  blockHash,
  from: account,
  to: EthereumWETH,
  input: '0xd0e30db0',
  value: '0x16345785d8a0000',
  chainId: '0x1',
};
const receipt = { transactionHash: txid, blockHash, status: '0x1' };

describe('EtherFi recovery transaction', () => {
  it('requires a matching mined native wrap and explicit successful receipt', () => {
    expect(
      classifyEtherFiRecoveryTransaction({
        ...args,
        phase: 'wrap',
        tx: wrap,
        receipt,
      }),
    ).toBe('success');
    expect(
      classifyEtherFiRecoveryTransaction({
        ...args,
        phase: 'wrap',
        tx: wrap,
        receipt: null,
      }),
    ).toBe('pending');
    expect(
      classifyEtherFiRecoveryTransaction({
        ...args,
        phase: 'wrap',
        tx: wrap,
        receipt: { ...receipt, status: undefined },
      }),
    ).toBe('pending');
    expect(
      classifyEtherFiRecoveryTransaction({
        ...args,
        phase: 'wrap',
        tx: wrap,
        receipt: { ...receipt, status: '0x0' },
      }),
    ).toBe('failed');
    expect(
      classifyEtherFiRecoveryTransaction({
        ...args,
        phase: 'wrap',
        tx: { ...wrap, from: vault },
        receipt,
      }),
    ).toBe('mismatch');
    expect(
      classifyEtherFiRecoveryTransaction({
        ...args,
        phase: 'wrap',
        tx: { ...wrap, value: '0x1' },
        receipt,
      }),
    ).toBe('mismatch');
    expect(
      classifyEtherFiRecoveryTransaction({
        ...args,
        phase: 'wrap',
        tx: wrap,
        receipt: { ...receipt, transactionHash: blockHash },
      }),
    ).toBe('mismatch');
    expect(
      classifyEtherFiRecoveryTransaction({
        ...args,
        phase: 'wrap',
        tx: wrap,
        receipt: { ...receipt, blockHash: txid },
      }),
    ).toBe('mismatch');
  });

  it('only accepts an approval of the canonical WETH and spender for at least the intended amount', () => {
    const approve = new utils.Interface([
      'function approve(address spender,uint256 amount)',
    ]);
    const tx = {
      ...wrap,
      value: '0x0',
      input: approve.encodeFunctionData('approve', [
        EtherFiLiquidReferContract,
        utils.parseUnits('0.1', 18),
      ]),
    };
    expect(
      classifyEtherFiRecoveryTransaction({
        ...args,
        phase: 'approve',
        tx,
        receipt,
      }),
    ).toBe('success');
    expect(
      classifyEtherFiRecoveryTransaction({
        ...args,
        phase: 'approve',
        tx: {
          ...tx,
          input: approve.encodeFunctionData('approve', [
            account,
            utils.parseUnits('0.1', 18),
          ]),
        },
        receipt,
      }),
    ).toBe('mismatch');
    expect(
      classifyEtherFiRecoveryTransaction({
        ...args,
        phase: 'approve',
        tx: {
          ...tx,
          input: approve.encodeFunctionData('approve', [
            EtherFiLiquidReferContract,
            1,
          ]),
        },
        receipt,
      }),
    ).toBe('mismatch');
  });

  it('binds a completed deposit to the intended vault, asset and amount', () => {
    const deposit = new utils.Interface([
      'function deposit(address teller,address depositAsset,uint256 depositAmount,uint256 minimumMint,address referrer)',
    ]);
    const teller = '0x9aa79c84b79816ab920bbce20f8f74557b514734';
    const tx = {
      ...wrap,
      to: EtherFiLiquidReferContract,
      value: '0x0',
      input: deposit.encodeFunctionData('deposit', [
        teller,
        EthereumWETH,
        utils.parseUnits('0.1', 18),
        1,
        account,
      ]),
    };
    expect(
      classifyEtherFiRecoveryTransaction({
        ...args,
        phase: 'deposit',
        tx,
        receipt,
      }),
    ).toBe('success');
    expect(
      classifyEtherFiRecoveryTransaction({
        ...args,
        phase: 'deposit',
        tx: { ...tx, to: account },
        receipt,
      }),
    ).toBe('mismatch');
    expect(
      classifyEtherFiRecoveryTransaction({
        ...args,
        phase: 'deposit',
        tx,
        receipt: { ...receipt, status: '0x0' },
        amount: '0.2',
      }),
    ).toBe('mismatch');
    expect(
      classifyEtherFiRecoveryTransaction({
        ...args,
        phase: 'deposit',
        tx: {
          ...tx,
          input: deposit.encodeFunctionData('deposit', [
            teller,
            EthereumWETH,
            utils.parseUnits('0.1', 18),
            0,
            account,
          ]),
        },
        receipt,
      }),
    ).toBe('mismatch');
  });
});
