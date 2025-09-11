import {
  type ITickParam,
  buildTickOptions,
  formatTickSize,
  getDefaultTickOption,
  isValidTickParam,
} from './tickSizeUtils';

describe('tickSizeUtils', () => {
  describe('buildTickOptions', () => {
    it('should generate 6 tick options for ETH price 4379.1 with decimals 0.1', () => {
      const price = 4379.1;
      const decimals = 0.1;
      const options = buildTickOptions(price, decimals);

      expect(options).toHaveLength(6);
      expect(options.map((o) => o.multiplier)).toEqual([
        1, 2, 5, 10, 100, 1000,
      ]);
      expect(options.map((o) => o.targetTick)).toEqual([
        0.1, 0.2, 0.5, 1, 10, 100,
      ]);
    });

    it('should map tick sizes to correct nSigFigs and mantissa for ETH 4379.1', () => {
      const price = 4379.1;
      const decimals = 0.1;
      const options = buildTickOptions(price, decimals);

      // For price 4379.1, floor(log10(4379.1)) = 3
      // Expected allowed pairs:
      // nSigFigs=2: step = 10^(3-1) = 100
      // nSigFigs=3: step = 10^(3-2) = 10
      // nSigFigs=4: step = 10^(3-3) = 1
      // nSigFigs=5, mantissa=1: step = 1 * 10^(3-4) = 0.1
      // nSigFigs=5, mantissa=2: step = 2 * 10^(3-4) = 0.2
      // nSigFigs=5, mantissa=5: step = 5 * 10^(3-4) = 0.5

      // multiplier=1: target=0.1 → should exactly match nSigFigs=5, mantissa=1
      expect(options[0].nSigFigs).toBe(5);
      expect(options[0].mantissa).toBe(1);
      expect(options[0].apiTick).toBe(0.1);
      expect(options[0].exact).toBe(true);

      // multiplier=2: target=0.2 → should exactly match nSigFigs=5, mantissa=2
      const option2 = options.find((o) => o.multiplier === 2);
      expect(option2?.targetTick).toBe(0.2);
      expect(option2?.nSigFigs).toBe(5);
      expect(option2?.mantissa).toBe(2);
      expect(option2?.apiTick).toBe(0.2);
      expect(option2?.exact).toBe(true);

      // multiplier=5: target=0.5 → should exactly match nSigFigs=5, mantissa=5
      const option5 = options.find((o) => o.multiplier === 5);
      expect(option5?.targetTick).toBe(0.5);
      expect(option5?.nSigFigs).toBe(5);
      expect(option5?.mantissa).toBe(5);
      expect(option5?.apiTick).toBe(0.5);
      expect(option5?.exact).toBe(true);

      // multiplier=10: target=1 → should exactly match nSigFigs=4
      const option10 = options.find((o) => o.multiplier === 10);
      expect(option10?.targetTick).toBe(1);
      expect(option10?.nSigFigs).toBe(4);
      expect(option10?.apiTick).toBe(1);
      expect(option10?.exact).toBe(true);

      // multiplier=100: target=10 → should exactly match nSigFigs=3
      const option100 = options.find((o) => o.multiplier === 100);
      expect(option100?.targetTick).toBe(10);
      expect(option100?.nSigFigs).toBe(3);
      expect(option100?.apiTick).toBe(10);
      expect(option100?.exact).toBe(true);

      // multiplier=1000: target=100 → should exactly match nSigFigs=2
      const option1000 = options.find((o) => o.multiplier === 1000);
      expect(option1000?.targetTick).toBe(100);
      expect(option1000?.nSigFigs).toBe(2);
      expect(option1000?.apiTick).toBe(100);
      expect(option1000?.exact).toBe(true);
    });

    it('should handle smaller prices correctly', () => {
      const price = 0.001_23; // BTC in fractions
      const decimals = 0.000_01;
      const options = buildTickOptions(price, decimals);

      expect(options).toHaveLength(6);
      expect(options[0].targetTick).toBe(0.000_01);
      expect(options[5].targetTick).toBe(0.01);

      // All options should have valid nSigFigs
      options.forEach((option) => {
        expect([2, 3, 4, 5]).toContain(option.nSigFigs);
        if (option.nSigFigs === 5) {
          expect([1, 2, 5]).toContain(option.mantissa);
        }
      });
    });

    it('should handle custom multipliers', () => {
      const price = 1000;
      const decimals = 1;
      const customMultipliers = [1, 5, 25];
      const options = buildTickOptions(price, decimals, customMultipliers);

      expect(options).toHaveLength(3);
      expect(options.map((o) => o.multiplier)).toEqual([1, 5, 25]);
      expect(options.map((o) => o.targetTick)).toEqual([1, 5, 25]);
    });

    it('should handle decimals = 0 with special multipliers for BTC price', () => {
      const price = 113_009.0; // BTC price
      const decimals = 0; // Integer-only token scenario
      const options = buildTickOptions(price, decimals);

      expect(options).toHaveLength(7); // 7 multipliers for decimals = 0
      // When decimals = 0, should use special multipliers [1, 10, 20, 50, 100, 1000, 10000]
      expect(options.map((o) => o.multiplier)).toEqual([
        1, 10, 20, 50, 100, 1000, 10_000,
      ]);
      expect(options.map((o) => o.targetTick)).toEqual([
        1, 10, 20, 50, 100, 1000, 10_000,
      ]);

      // Verify mapping for BTC price
      // For price 113009, floor(log10(113009)) = 5
      // Expected allowed pairs:
      // nSigFigs=2: step = 10^(5-1) = 10000
      // nSigFigs=3: step = 10^(5-2) = 1000
      // nSigFigs=4: step = 10^(5-3) = 100
      // nSigFigs=5, m=1: step = 1 * 10^(5-4) = 10
      // nSigFigs=5, m=2: step = 2 * 10^(5-4) = 20
      // nSigFigs=5, m=5: step = 5 * 10^(5-4) = 50

      // target=1 → should map to nearest (probably nSigFigs=5, m=1, step=10)
      const option1 = options.find((o) => o.multiplier === 1);
      expect(option1?.targetTick).toBe(1);
      expect(option1?.nSigFigs).toBe(5);
      expect(option1?.mantissa).toBe(1);
      expect(option1?.apiTick).toBe(10);
      expect(option1?.exact).toBe(false);

      // target=10 → should exactly match nSigFigs=5, m=1
      const option10 = options.find((o) => o.multiplier === 10);
      expect(option10?.targetTick).toBe(10);
      expect(option10?.nSigFigs).toBe(5);
      expect(option10?.mantissa).toBe(1);
      expect(option10?.apiTick).toBe(10);
      expect(option10?.exact).toBe(true);

      // target=100 → should exactly match nSigFigs=4
      const option100 = options.find((o) => o.multiplier === 100);
      expect(option100?.targetTick).toBe(100);
      expect(option100?.nSigFigs).toBe(4);
      expect(option100?.apiTick).toBe(100);
      expect(option100?.exact).toBe(true);

      // target=1000 → should exactly match nSigFigs=3
      const option1000 = options.find((o) => o.multiplier === 1000);
      expect(option1000?.targetTick).toBe(1000);
      expect(option1000?.nSigFigs).toBe(3);
      expect(option1000?.apiTick).toBe(1000);
      expect(option1000?.exact).toBe(true);

      // target=10000 → should exactly match nSigFigs=2
      const option10000 = options.find((o) => o.multiplier === 10_000);
      expect(option10000?.targetTick).toBe(10_000);
      expect(option10000?.nSigFigs).toBe(2);
      expect(option10000?.apiTick).toBe(10_000);
      expect(option10000?.exact).toBe(true);

      options.forEach((option) => {
        expect(isValidTickParam(option)).toBe(true);
      });
    });

    it('should throw error for invalid inputs', () => {
      expect(() => buildTickOptions(0, 0.1)).toThrow('price must be > 0');
      expect(() => buildTickOptions(-1, 0.1)).toThrow('price must be > 0');
      expect(() => buildTickOptions(1000, -0.1)).toThrow(
        'decimals must be >= 0',
      );
    });
  });

  describe('getDefaultTickOption', () => {
    it('should prefer exact matches', () => {
      const options: ITickParam[] = [
        {
          targetTick: 0.1,
          nSigFigs: 5,
          mantissa: 1,
          apiTick: 1,
          exact: false,
          multiplier: 1,
          label: '0.1',
          value: '0.1',
        },
        { targetTick: 1, nSigFigs: 4, apiTick: 1, exact: true, multiplier: 10, label: '1', value: '1' },
        {
          targetTick: 10,
          nSigFigs: 3,
          apiTick: 10,
          exact: true,
          multiplier: 100,
          label: '10',
          value: '10',
        },
      ];

      const defaultOption = getDefaultTickOption(options);
      expect(defaultOption.exact).toBe(true);
      expect(defaultOption.multiplier).toBe(10); // First exact match
    });

    it('should fallback to first option if no exact matches', () => {
      const options: ITickParam[] = [
        {
          targetTick: 0.1,
          nSigFigs: 5,
          mantissa: 1,
          apiTick: 1,
          exact: false,
          multiplier: 1,
          label: '0.1',
          value: '0.1',
        },
        {
          targetTick: 0.2,
          nSigFigs: 5,
          mantissa: 2,
          apiTick: 2,
          exact: false,
          multiplier: 2,
          label: '0.2',
          value: '0.2',
        },
      ];

      const defaultOption = getDefaultTickOption(options);
      expect(defaultOption).toBe(options[0]);
    });
  });

  describe('formatTickSize', () => {
    it('should format tick sizes correctly', () => {
      expect(formatTickSize(1)).toBe('1');
      expect(formatTickSize(10)).toBe('10');
      expect(formatTickSize(100)).toBe('100');
      expect(formatTickSize(0.1)).toBe('0.1');
      expect(formatTickSize(0.01)).toBe('0.01');
      expect(formatTickSize(0.001)).toBe('0.001');
      expect(formatTickSize(0.0001)).toBe('0.0001');
    });
  });

  describe('isValidTickParam', () => {
    it('should validate nSigFigs 2-4 without mantissa', () => {
      expect(
        isValidTickParam({
          targetTick: 1,
          nSigFigs: 2,
          apiTick: 1,
          exact: true,
          multiplier: 1,
          label: '1',
          value: '1',
        }),
      ).toBe(true);

      expect(
        isValidTickParam({
          targetTick: 1,
          nSigFigs: 3,
          apiTick: 1,
          exact: true,
          multiplier: 1,
          label: '1',
          value: '1',
        }),
      ).toBe(true);

      expect(
        isValidTickParam({
          targetTick: 1,
          nSigFigs: 4,
          apiTick: 1,
          exact: true,
          multiplier: 1,
          label: '1',
          value: '1',
        }),
      ).toBe(true);
    });

    it('should validate nSigFigs=5 with valid mantissa', () => {
      expect(
        isValidTickParam({
          targetTick: 1,
          nSigFigs: 5,
          mantissa: 1,
          apiTick: 1,
          exact: true,
          multiplier: 1,
          label: '1',
          value: '1',
        }),
      ).toBe(true);

      expect(
        isValidTickParam({
          targetTick: 1,
          nSigFigs: 5,
          mantissa: 2,
          apiTick: 1,
          exact: true,
          multiplier: 1,
          label: '1',
          value: '1',
        }),
      ).toBe(true);

      expect(
        isValidTickParam({
          targetTick: 1,
          nSigFigs: 5,
          mantissa: 5,
          apiTick: 1,
          exact: true,
          multiplier: 1,
          label: '1',
          value: '1',
        }),
      ).toBe(true);
    });

    it('should reject invalid combinations', () => {
      // Invalid nSigFigs
      expect(
        isValidTickParam({
          targetTick: 1,
          nSigFigs: 1 as any,
          apiTick: 1,
          exact: true,
          multiplier: 1,
          label: '1',
          value: '1',
        }),
      ).toBe(false);

      // nSigFigs=5 without mantissa
      expect(
        isValidTickParam({
          targetTick: 1,
          nSigFigs: 5,
          apiTick: 1,
          exact: true,
          multiplier: 1,
          label: '1',
          value: '1',
        }),
      ).toBe(false);

      // nSigFigs=5 with invalid mantissa
      expect(
        isValidTickParam({
          targetTick: 1,
          nSigFigs: 5,
          mantissa: 3 as any,
          apiTick: 1,
          exact: true,
          multiplier: 1,
          label: '1',
          value: '1',
        }),
      ).toBe(false);

      // nSigFigs 2-4 with mantissa
      expect(
        isValidTickParam({
          targetTick: 1,
          nSigFigs: 3,
          mantissa: 1,
          apiTick: 1,
          exact: true,
          multiplier: 1,
          label: '1',
          value: '1',
        }),
      ).toBe(false);
    });
  });

  describe('edge cases and real world scenarios', () => {
    it('should handle very large prices', () => {
      const price = 100_000; // Large price
      const decimals = 100;
      const options = buildTickOptions(price, decimals);

      expect(options).toHaveLength(6);
      options.forEach((option) => {
        expect(isValidTickParam(option)).toBe(true);
      });
    });

    it('should handle very small prices', () => {
      const price = 0.000_001; // Very small price
      const decimals = 0.000_000_1;
      const options = buildTickOptions(price, decimals);

      expect(options).toHaveLength(6);
      options.forEach((option) => {
        expect(isValidTickParam(option)).toBe(true);
      });
    });

    it('should provide reasonable API tick sizes', () => {
      const price = 4379.1;
      const decimals = 0.1;
      const options = buildTickOptions(price, decimals);

      // API tick sizes should be reasonable powers of 10 or simple multiples
      options.forEach((option) => {
        expect(option.apiTick).toBeGreaterThan(0);
        expect(Number.isFinite(option.apiTick)).toBe(true);
      });
    });
  });
});
