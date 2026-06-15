import type { IEncodedTxTron } from '@onekeyhq/core/src/chains/tron/types';
import { ThirdPartyMethodNotSupported } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';

import {
  buildTrezorTronContract,
  buildTrezorTronSignTransactionParams,
  buildTrezorTronSignedRawTx,
} from './KeyringHardwareTrezor';

describe('buildTrezorTronContract', () => {
  it('maps TransferContract into the Trezor structured contract shape', () => {
    expect(
      buildTrezorTronContract({
        type: 'TransferContract',
        parameter: {
          value: {
            to_address: '411111111111111111111111111111111111111111',
            amount: 123,
          },
        },
      } as IEncodedTxTron['raw_data']['contract'][0]),
    ).toEqual({
      transferContract: {
        toAddress: '411111111111111111111111111111111111111111',
        amount: 123,
      },
    });
  });

  it('rejects TriggerSmartContract calls that send TRX with call_value', () => {
    expect(() =>
      buildTrezorTronContract({
        type: 'TriggerSmartContract',
        parameter: {
          value: {
            contract_address: '412222222222222222222222222222222222222222',
            data: 'a9059cbb',
            call_value: 1,
          },
        },
      } as IEncodedTxTron['raw_data']['contract'][0]),
    ).toThrow(ThirdPartyMethodNotSupported);
  });

  it('maps TriggerSmartContract token calls without call_value', () => {
    expect(
      buildTrezorTronContract({
        type: 'TriggerSmartContract',
        parameter: {
          value: {
            contract_address: '412222222222222222222222222222222222222222',
            data: 'a9059cbb',
            call_value: 0,
          },
        },
      } as IEncodedTxTron['raw_data']['contract'][0]),
    ).toEqual({
      triggerSmartContract: {
        contractAddress: '412222222222222222222222222222222222222222',
        data: 'a9059cbb',
      },
    });
  });

  it('maps resource contracts using Trezor field names', () => {
    expect(
      buildTrezorTronContract({
        type: 'FreezeBalanceV2Contract',
        parameter: {
          value: {
            frozen_balance: 1_000_000,
            resource: 'ENERGY',
          },
        },
      } as IEncodedTxTron['raw_data']['contract'][0]),
    ).toEqual({
      freezeBalanceV2Contract: {
        balance: 1_000_000,
        resource: 'ENERGY',
      },
    });

    expect(
      buildTrezorTronContract({
        type: 'UnfreezeBalanceV2Contract',
        parameter: {
          value: {
            unfreeze_balance: 1_000_000,
            resource: 'BANDWIDTH',
          },
        },
      } as IEncodedTxTron['raw_data']['contract'][0]),
    ).toEqual({
      unfreezeBalanceV2Contract: {
        balance: 1_000_000,
      },
    });
  });

  it('maps vote and withdraw-expired-unfreeze contracts', () => {
    expect(
      buildTrezorTronContract({
        type: 'VoteWitnessContract',
        parameter: {
          value: {
            votes: [
              {
                vote_address: '413333333333333333333333333333333333333333',
                vote_count: 2,
              },
            ],
          },
        },
      } as IEncodedTxTron['raw_data']['contract'][0]),
    ).toEqual({
      voteWitnessContract: {
        votes: [
          {
            voteAddress: '413333333333333333333333333333333333333333',
            voteCount: 2,
          },
        ],
      },
    });

    expect(
      buildTrezorTronContract({
        type: 'WithdrawExpireUnfreezeContract',
        parameter: {
          value: {},
        },
      } as IEncodedTxTron['raw_data']['contract'][0]),
    ).toEqual({
      withdrawExpireUnfreezeContract: {},
    });
  });

  it('rejects unsupported TRON contract types as third-party unsupported methods', () => {
    expect(() =>
      buildTrezorTronContract({
        type: 'DelegateResourceContract',
        parameter: {
          value: {},
        },
      } as IEncodedTxTron['raw_data']['contract'][0]),
    ).toThrow(ThirdPartyMethodNotSupported);
  });
});

describe('buildTrezorTronSignTransactionParams', () => {
  it('rejects multi-contract TRON transactions because Trezor signs only one contract', () => {
    expect(() =>
      buildTrezorTronSignTransactionParams({
        path: "m/44'/195'/0'/0/0",
        encodedTx: {
          txID: 'txid',
          raw_data_hex: 'raw',
          raw_data: {
            ref_block_bytes: 'e942',
            ref_block_hash: '6394747da9fee421',
            expiration: 1_752_562_632_000,
            timestamp: 1_752_562_572_000,
            contract: [
              {
                type: 'TransferContract',
                parameter: {
                  value: {
                    owner_address: '41f2cd810c48c401d392ead3c6e1e1cb9f57750a58',
                    to_address: '411111111111111111111111111111111111111111',
                    amount: 123,
                  },
                },
              },
              {
                type: 'WithdrawExpireUnfreezeContract',
                parameter: {
                  value: {
                    owner_address: '41f2cd810c48c401d392ead3c6e1e1cb9f57750a58',
                  },
                },
              },
            ],
          },
        } as IEncodedTxTron,
      }),
    ).toThrow(ThirdPartyMethodNotSupported);
  });

  it('builds the structured Trezor TRON sign params for a single contract', () => {
    expect(
      buildTrezorTronSignTransactionParams({
        path: "m/44'/195'/0'/0/0",
        encodedTx: {
          txID: 'txid',
          raw_data_hex: 'raw',
          raw_data: {
            ref_block_bytes: 'e942',
            ref_block_hash: '6394747da9fee421',
            expiration: 1_752_562_632_000,
            timestamp: 1_752_562_572_000,
            fee_limit: 50_000_000,
            data: 'abcd',
            contract: [
              {
                type: 'TriggerSmartContract',
                parameter: {
                  value: {
                    owner_address: '41f2cd810c48c401d392ead3c6e1e1cb9f57750a58',
                    contract_address:
                      '4142a1e39aefa49290f2b3f9ed688d7cecf86cd6e0',
                    data: 'a9059cbb',
                    call_value: 0,
                  },
                },
              },
            ],
          },
        } as IEncodedTxTron,
      }),
    ).toEqual({
      path: "m/44'/195'/0'/0/0",
      ownerAddress: '41f2cd810c48c401d392ead3c6e1e1cb9f57750a58',
      refBlockBytes: 'e942',
      refBlockHash: '6394747da9fee421',
      expiration: 1_752_562_632_000,
      timestamp: 1_752_562_572_000,
      feeLimit: 50_000_000,
      data: 'abcd',
      contract: {
        triggerSmartContract: {
          contractAddress: '4142a1e39aefa49290f2b3f9ed688d7cecf86cd6e0',
          data: 'a9059cbb',
        },
      },
    });
  });
});

describe('buildTrezorTronSignedRawTx', () => {
  it('uses the original raw_data_hex when Trezor does not return serializedTx', () => {
    const encodedTx = {
      txID: 'txid',
      raw_data_hex: 'originalRawData',
      raw_data: {
        ref_block_bytes: 'e942',
        ref_block_hash: '6394747da9fee421',
        expiration: 1_752_562_632_000,
        timestamp: 1_752_562_572_000,
        contract: [],
      },
    } as unknown as IEncodedTxTron;

    expect(
      JSON.parse(
        buildTrezorTronSignedRawTx({
          encodedTx,
          signature: 'signature',
        }),
      ),
    ).toEqual({
      ...encodedTx,
      raw_data_hex: 'originalRawData',
      signature: ['signature'],
    });
  });

  it('prefers Trezor serializedTx when it is returned', () => {
    const encodedTx = {
      txID: 'txid',
      raw_data_hex: 'originalRawData',
      raw_data: {
        ref_block_bytes: 'e942',
        ref_block_hash: '6394747da9fee421',
        expiration: 1_752_562_632_000,
        timestamp: 1_752_562_572_000,
        contract: [],
      },
    } as unknown as IEncodedTxTron;

    expect(
      JSON.parse(
        buildTrezorTronSignedRawTx({
          encodedTx,
          signature: 'signature',
          serializedTx: 'trezorRawData',
        }),
      ).raw_data_hex,
    ).toBe('trezorRawData');
  });
});
