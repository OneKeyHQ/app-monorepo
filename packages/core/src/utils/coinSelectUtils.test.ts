import {
  coinSelect,
  coinSelectAccumulativeDesc,
} from './coinSelectUtils';

describe('coinSelectUtils', () => {
  describe('coinSelect', () => {
    const mockUtxos = [
      { txId: 'tx1', vout: 0, value: 100000, address: 'addr1', path: 'm/44/0/0/0/0' },
      { txId: 'tx2', vout: 1, value: 50000, address: 'addr2', path: 'm/44/0/0/0/1' },
      { txId: 'tx3', vout: 0, value: 30000, address: 'addr3', path: 'm/44/0/0/0/2' },
    ];

    it('should select optimal UTXOs with auto algorithm', () => {
      const result = coinSelect({
        inputsForCoinSelect: mockUtxos,
        outputsForCoinSelect: [{ address: 'recipient', value: '80000' }],
        feeRate: '10',
        algorithm: 'auto',
      });

      expect(result.inputs).toBeDefined();
      expect(result.inputs?.length).toBeGreaterThan(0);
      expect(result.outputs).toBeDefined();
      expect(result.fee).toBeGreaterThan(0);
    });

    it('should handle send-max output', () => {
      const result = coinSelect({
        inputsForCoinSelect: mockUtxos,
        outputsForCoinSelect: [{ address: 'recipient', type: 'send-max' }],
        feeRate: '10',
      });

      expect(result.inputs).toBeDefined();
      expect(result.outputs?.length).toBe(1);
    });

    it('should return empty inputs when insufficient funds', () => {
      const result = coinSelect({
        inputsForCoinSelect: [{ ...mockUtxos[2], value: 1000 }],
        outputsForCoinSelect: [{ address: 'recipient', value: '50000' }],
        feeRate: '100',
      });

      expect(result.inputs?.length).toBe(0);
    });

    it('should work with accumulative algorithm', () => {
      const result = coinSelect({
        inputsForCoinSelect: mockUtxos,
        outputsForCoinSelect: [{ address: 'recipient', value: '60000' }],
        feeRate: '10',
        algorithm: 'accumulative',
      });

      expect(result.inputs).toBeDefined();
      expect(result.fee).toBeGreaterThan(0);
    });

    it('should work with blackjack algorithm', () => {
      const result = coinSelect({
        inputsForCoinSelect: mockUtxos,
        outputsForCoinSelect: [{ address: 'recipient', value: '40000' }],
        feeRate: '10',
        algorithm: 'blackjack',
      });

      expect(result.inputs).toBeDefined();
    });

    it('should work with split algorithm', () => {
      const result = coinSelect({
        inputsForCoinSelect: mockUtxos,
        outputsForCoinSelect: [{ address: 'recipient', value: '120000' }],
        feeRate: '10',
        algorithm: 'split',
      });

      expect(result.inputs).toBeDefined();
    });
  });

  describe('coinSelectAccumulativeDesc', () => {
    it('should sort UTXOs by score descending', () => {
      const utxos = [
        { txId: 'tx1', vout: 0, value: 50000, address: 'addr1' },
        { txId: 'tx2', vout: 0, value: 100000, address: 'addr2' },
        { txId: 'tx3', vout: 0, value: 30000, address: 'addr3' },
      ];

      const result = coinSelectAccumulativeDesc(
        utxos,
        [{ address: 'recipient', value: 80000 }],
        10,
      );

      expect(result.inputs).toBeDefined();
      // Should select larger UTXOs first due to sorting
      if (result.inputs && result.inputs.length > 0) {
        expect(result.inputs[0].value).toBeGreaterThanOrEqual(50000);
      }
    });

    it('should prioritize forceSelect UTXOs', () => {
      const utxos = [
        { txId: 'tx1', vout: 0, value: 10000, address: 'addr1', forceSelect: true },
        { txId: 'tx2', vout: 0, value: 100000, address: 'addr2' },
      ];

      const result = coinSelectAccumulativeDesc(
        utxos,
        [{ address: 'recipient', value: 5000 }],
        10,
      );

      expect(result.inputs).toBeDefined();
      if (result.inputs && result.inputs.length > 0) {
        // forceSelect UTXO should be selected first
        const selectedTxIds = result.inputs.map(i => i.txId);
        expect(selectedTxIds).toContain('tx1');
      }
    });
  });
});
