import { buildTrezorSolSignTransactionParams } from './KeyringHardwareTrezor';

describe('buildTrezorSolSignTransactionParams', () => {
  it('omits additionalInfo when there are no ATA details', () => {
    expect(
      buildTrezorSolSignTransactionParams({
        path: "m/44'/501'/0'/0'",
        serializedTx: 'abcd',
      }),
    ).toEqual({
      path: "m/44'/501'/0'/0'",
      serializedTx: 'abcd',
    });
  });

  it('passes Solana token definition bytes when available', () => {
    const encodedToken = new ArrayBuffer(3);
    new Uint8Array(encodedToken).set([1, 2, 3]);

    expect(
      buildTrezorSolSignTransactionParams({
        path: "m/44'/501'/0'/0'",
        serializedTx: 'abcd',
        encodedToken,
        ataDetails: [
          {
            owner: 'BVRFH6vt5bNXub6WnnFRgaHFTcbkjBrf7x1troU1izGg',
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            mintAddress: '9hayiPmEobVfiTbw5R91StWeQzw9EJGfswLH5o33UDAW',
            associatedTokenAddress:
              'J5rhFGUkeoHVnCvMyqWq1XPjfU1G1hsTh9tTQtST2out',
          },
        ],
      }),
    ).toEqual({
      path: "m/44'/501'/0'/0'",
      serializedTx: 'abcd',
      additionalInfo: {
        encodedToken,
        tokenAccountsInfos: [
          {
            baseAddress: 'BVRFH6vt5bNXub6WnnFRgaHFTcbkjBrf7x1troU1izGg',
            tokenProgram: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            tokenMint: '9hayiPmEobVfiTbw5R91StWeQzw9EJGfswLH5o33UDAW',
            tokenAccount: 'J5rhFGUkeoHVnCvMyqWq1XPjfU1G1hsTh9tTQtST2out',
          },
        ],
      },
    });
  });
});
