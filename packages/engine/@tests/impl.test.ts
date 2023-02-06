import {
  coinTypeToImpl,
  defaultCurveMap,
  getAccountNameInfoByImpl,
  getCurveByImpl,
  getDefaultCurveByCoinType,
  implToCoinTypes,
  isCoinTypeCompatibleWithImpl,
} from '../src/managers/impl';

describe('test impl', () => {
  test('test coinTypeToImpl function', () => {
    Object.entries(coinTypeToImpl).forEach(([coinType, impl]) => {
      expect(coinTypeToImpl[coinType]).toBe(impl);
    });
  });

  test('should getCurveByImpl function not throw error', () => {
    Object.keys(implToCoinTypes).forEach((impl) => {
      expect(getCurveByImpl(impl)).toBe(defaultCurveMap[impl]);
    });
  });

  test('test isCoinTypeCompatibleWithImpl function', () => {
    Object.entries(coinTypeToImpl).forEach(([coinType, impl]) => {
      expect(isCoinTypeCompatibleWithImpl(coinType, impl)).toBeTruthy();
    });
  });

  test('test getDefaultCurveByCoinType function', () => {
    Object.entries(coinTypeToImpl).forEach(([coinType, impl]) => {
      expect(getDefaultCurveByCoinType(coinType)).toBe(defaultCurveMap[impl]);
    });
  });

  test('test getAccountNameInfoByImpl function', () => {
    Object.keys(implToCoinTypes).forEach((impl) => {
      const accountNameInfos = getAccountNameInfoByImpl(impl);
      expect(accountNameInfos).toBeTruthy();

      Object.values(accountNameInfos).forEach((accountNameInfo) => {
        expect(accountNameInfo.prefix).toBeTruthy();
        expect(accountNameInfo.category).toBeTruthy();
        expect(accountNameInfo.template).toBeTruthy();
        const coinTypes = implToCoinTypes[impl];
        expect(
          (Array.isArray(coinTypes) ? coinTypes : [coinTypes]).includes(
            accountNameInfo.coinType,
          ),
        ).toBeTruthy();
      });
    });
  });
});
