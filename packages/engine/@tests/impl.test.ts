import {
  coinTypeToImpl,
  defaultCurveMap,
  getAccountNameInfoByImpl,
  getAccountNameInfoByTemplate,
  getCurveByImpl,
  getDBAccountTemplate,
  getDefaultAccountNameInfoByImpl,
  getDefaultCurveByCoinType,
  implToCoinTypes,
  isCoinTypeCompatibleWithImpl,
} from '../src/managers/impl';

import getDBAccountFixtures from './fixtures/getDBAccountTemplate';

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

  test('test getDefaultAccountNameInfoByImpl function', () => {
    Object.keys(implToCoinTypes).forEach((impl: string) => {
      const defaultInfo = getAccountNameInfoByImpl(impl).default;
      const accountNameInfo = getDefaultAccountNameInfoByImpl(impl);
      expect(accountNameInfo).toBeTruthy();
      expect(accountNameInfo.prefix).toBe(defaultInfo.prefix);
      expect(accountNameInfo.category).toBe(defaultInfo.category);
      expect(accountNameInfo.template).toBe(defaultInfo.template);
      const coinTypes = implToCoinTypes[impl];
      expect(
        (Array.isArray(coinTypes) ? coinTypes : [coinTypes]).includes(
          accountNameInfo.coinType,
        ),
      ).toBeTruthy();
    });
  });

  test('test getAccountNameInfoByTemplate function', () => {
    Object.keys(implToCoinTypes).forEach((impl: string) => {
      const accountNameInfos = getAccountNameInfoByImpl(impl);
      Object.values(accountNameInfos).forEach((accountNameInfo) => {
        expect(
          getAccountNameInfoByTemplate(impl, accountNameInfo.template),
        ).toBe(accountNameInfo);
      });
    });
  });

  getDBAccountFixtures.forEach((f) => {
    it(f.description, () => {
      const response = getDBAccountTemplate(f.params as any);
      expect(response).toEqual(f.response);
    });
  });
});
