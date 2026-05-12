import {
  type IHistoryItemDetail,
  formatAmount,
  formatHistoryItem,
  formatHistoryList,
  mapStatus,
} from '../core/history-fetcher';

describe('history-fetcher', () => {
  const TOKENS_MAP = {
    '': {
      info: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
        address: '',
        isNative: true,
        logoURI: '',
      },
      price: '2500',
    },
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
      info: {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        isNative: false,
        logoURI: '',
      },
      price: '1.0',
    },
  };

  describe('mapStatus', () => {
    it('maps "1" to "success"', () => {
      expect(mapStatus('1')).toBe('success');
    });
    it('maps "0" to "failed"', () => {
      expect(mapStatus('0')).toBe('failed');
    });
    it('maps "2" to "pending"', () => {
      expect(mapStatus('2')).toBe('pending');
    });
    it('returns "unknown" for unexpected values', () => {
      expect(mapStatus('99')).toBe('unknown');
    });
  });

  describe('formatAmount', () => {
    it('converts wei to ETH (18 decimals)', () => {
      expect(formatAmount('1500000000000000000', 18)).toBe('1.5');
    });
    it('handles sub-unit amount (1 wei)', () => {
      expect(formatAmount('1', 18)).toBe('0.000000000000000001');
    });
    it('handles zero', () => {
      expect(formatAmount('0', 18)).toBe('0');
    });
    it('handles empty string', () => {
      expect(formatAmount('', 18)).toBe('0');
    });
    it('handles negative amount', () => {
      expect(formatAmount('-1500000000000000000', 18)).toBe('-1.5');
    });
    it('handles large amount (1000 ETH)', () => {
      expect(formatAmount('1000000000000000000000', 18)).toBe('1000');
    });
    it('handles zero decimals', () => {
      expect(formatAmount('12345', 0)).toBe('12345');
    });
    it('handles 6 decimals (USDC)', () => {
      expect(formatAmount('100000000', 6)).toBe('100');
    });
    it('strips trailing zeros', () => {
      expect(formatAmount('1500000', 6)).toBe('1.5');
    });
    it('handles pre-formatted value with decimal point', () => {
      expect(formatAmount('109875.092616543', 18)).toBe('109875.092616543');
    });
    it('strips trailing dot from pre-formatted value', () => {
      expect(formatAmount('63103500000.', 0)).toBe('63103500000');
    });
    it('strips trailing zeros from pre-formatted value', () => {
      expect(formatAmount('1.50000', 18)).toBe('1.5');
    });
  });

  describe('formatHistoryItem', () => {
    const baseTx = {
      key: 'tx1',
      networkId: 'evm--1',
      tx: '0xabc123',
      riskLevel: 0,
      type: 'Send' as const,
      status: '1' as const,
      from: '0xSender',
      to: '0xReceiver',
      timestamp: 1_711_872_000,
      nonce: 5,
      gasFee: '0.0021',
      gasFeeFiatValue: '5.25',
      functionCode: '',
      params: [],
      value: '0',
      label: 'Send',
      sends: [
        {
          type: 0 as const,
          from: '0xSender',
          to: '0xReceiver',
          token: '',
          key: '',
          amount: '1500000000000000000',
          label: 'Send',
          isNative: true,
        },
      ],
      receives: [],
      block: 19_234_567,
      confirmations: 128,
    };

    it('formats a send tx in list mode', () => {
      const result = formatHistoryItem(baseTx, TOKENS_MAP, false);
      expect(result.txHash).toBe('0xabc123');
      expect(result.type).toBe('Send');
      expect(result.status).toBe('success');
      expect(result.from).toBe('0xSender');
      expect(result.to).toBe('0xReceiver');
      expect(result.sends).toHaveLength(1);
      expect(result.sends[0].token).toBe('ETH');
      expect(result.sends[0].amount).toBe('1.5');
      expect(result.sends[0].fiatValue).toBe('3750.00');
      expect(result.receives).toHaveLength(0);
      expect(result.gasFee).toBe('0.0021');
      expect(result.gasFeeFiatValue).toBe('5.25');
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // list mode: no detail fields
      expect(result).not.toHaveProperty('block');
      expect(result).not.toHaveProperty('nonce');
    });

    it('includes detail fields when detail=true', () => {
      const result = formatHistoryItem(
        baseTx,
        TOKENS_MAP,
        true,
      ) as IHistoryItemDetail;
      expect(result.block).toBe(19_234_567);
      expect(result.nonce).toBe(5);
      expect(result.confirmations).toBe(128);
      expect(result.label).toBe('Send');
      expect(result.sends[0]).toHaveProperty('contractAddress');
      expect(result.sends[0]).toHaveProperty('isNative');
    });

    it('handles ERC-20 transfer with token lookup', () => {
      const erc20Tx = {
        ...baseTx,
        sends: [
          {
            type: 0 as const,
            from: '0xSender',
            to: '0xReceiver',
            token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            key: '',
            amount: '100000000',
            label: 'Send',
          },
        ],
      };
      const result = formatHistoryItem(erc20Tx, TOKENS_MAP, false);
      expect(result.sends[0].token).toBe('USDC');
      expect(result.sends[0].amount).toBe('100');
      expect(result.sends[0].fiatValue).toBe('100.00');
    });

    it('handles tx with empty sends and receives', () => {
      const emptyTx = { ...baseTx, sends: [], receives: [] };
      const result = formatHistoryItem(emptyTx, TOKENS_MAP, false);
      expect(result.sends).toEqual([]);
      expect(result.receives).toEqual([]);
    });

    it('handles unknown token gracefully', () => {
      const unknownTx = {
        ...baseTx,
        sends: [
          {
            type: 0 as const,
            from: '0xSender',
            to: '0xReceiver',
            token: '0xUnknownContract',
            key: '',
            amount: '1000000',
            label: 'Send',
          },
        ],
      };
      const result = formatHistoryItem(unknownTx, TOKENS_MAP, false);
      expect(result.sends[0].token).toBe('0xUnknownContract');
      expect(result.sends[0].amount).toBe('1000000');
    });
  });

  describe('formatHistoryList', () => {
    it('sorts by timestamp descending', () => {
      const txs = [
        {
          key: 'a',
          networkId: 'evm--1',
          tx: '0xa',
          riskLevel: 0,
          type: 'Send' as const,
          status: '1' as const,
          from: '0x1',
          to: '0x2',
          timestamp: 1000,
          nonce: 0,
          gasFee: '0',
          gasFeeFiatValue: '0',
          functionCode: '',
          params: [],
          value: '0',
          label: '',
          sends: [],
          receives: [],
        },
        {
          key: 'b',
          networkId: 'evm--1',
          tx: '0xb',
          riskLevel: 0,
          type: 'Receive' as const,
          status: '1' as const,
          from: '0x1',
          to: '0x2',
          timestamp: 2000,
          nonce: 1,
          gasFee: '0',
          gasFeeFiatValue: '0',
          functionCode: '',
          params: [],
          value: '0',
          label: '',
          sends: [],
          receives: [],
        },
      ];
      const resp = { data: txs, tokens: {}, nfts: {}, hasMore: false };
      const result = formatHistoryList(resp, false);
      expect(result[0].txHash).toBe('0xb');
      expect(result[1].txHash).toBe('0xa');
    });

    it('returns empty array for empty data', () => {
      const resp = { data: [], tokens: {}, nfts: {}, hasMore: false };
      const result = formatHistoryList(resp, false);
      expect(result).toEqual([]);
    });
  });
});
