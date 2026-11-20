import { getReplaceTxGasLimit } from './replaceTxGasLimit';

const accessList = [{ address: `0x${'33'.repeat(20)}`, storageKeys: [] }];

describe('getReplaceTxGasLimit', () => {
  it('raises a 21000 limit signed without the list to the fresh estimate', () => {
    // An older app version signed this transfer without the access list that
    // history kept; one address adds 2400 intrinsic gas to the replacement.
    expect(
      getReplaceTxGasLimit({
        replaceEncodedTx: { accessList },
        originalGasLimit: '0x5208',
        estimatedGasLimit: '23400',
      }),
    ).toBe('23400');
  });

  it('keeps the original limit when it already covers the estimate', () => {
    expect(
      getReplaceTxGasLimit({
        replaceEncodedTx: { accessList },
        originalGasLimit: '0x5b68',
        estimatedGasLimit: '23400',
      }),
    ).toBe('0x5b68');
    expect(
      getReplaceTxGasLimit({
        replaceEncodedTx: { accessList },
        originalGasLimit: '23400',
        estimatedGasLimit: '23400',
      }),
    ).toBe('23400');
  });

  it('keeps the original limit for a replacement without an access list', () => {
    expect(
      getReplaceTxGasLimit({
        replaceEncodedTx: {},
        originalGasLimit: '0x5208',
        estimatedGasLimit: '50000',
      }),
    ).toBe('0x5208');
    expect(
      getReplaceTxGasLimit({
        replaceEncodedTx: { accessList: [] },
        originalGasLimit: '0x5208',
        estimatedGasLimit: '50000',
      }),
    ).toBe('0x5208');
  });

  it('keeps the original limit when there is no usable estimate', () => {
    expect(
      getReplaceTxGasLimit({
        replaceEncodedTx: { accessList },
        originalGasLimit: '0x5208',
        estimatedGasLimit: undefined,
      }),
    ).toBe('0x5208');
    expect(
      getReplaceTxGasLimit({
        replaceEncodedTx: { accessList },
        originalGasLimit: '0x5208',
        estimatedGasLimit: 'not-a-number',
      }),
    ).toBe('0x5208');
  });
});
