import fs from 'fs';
import path from 'path';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { isNativeHomeEnabled } from './nativeHomeFeatureFlag.native';
import { NativeHomePageView } from './NativeHomePageView.native';
import { HomePageView } from './pages/HomePageView';

jest.mock('./pages/HomePageView', () => ({
  HomePageView: jest.fn(() => null),
}));

function readSource(fileName: string) {
  return fs.readFileSync(
    path.isAbsolute(fileName) ? fileName : path.join(__dirname, fileName),
    'utf8',
  );
}

function listProductionSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listProductionSourceFiles(absolutePath);
    }
    if (
      !/\.tsx?$/.test(entry.name) ||
      /\.(?:test|spec)\.tsx?$/.test(entry.name)
    ) {
      return [];
    }
    return [absolutePath];
  });
}

describe('Native Home runtime surface', () => {
  it('returns only the shared HomePageView and forwards surface props', () => {
    const onPressHide = jest.fn();
    const sharedHomeElement = NativeHomePageView({
      sceneName: EAccountSelectorSceneName.home,
      onPressHide,
    });

    expect(sharedHomeElement.type).toBe(HomePageView);
    expect(sharedHomeElement.props).toEqual({
      sceneName: EAccountSelectorSceneName.home,
      onPressHide,
    });
  });

  it('keeps legacy NativeHomePage and HomeContainer out of the entry modules', () => {
    const nativeSurfaceSource = readSource('NativeHomePageView.native.tsx');
    const featureFlagSource = readSource('nativeHomeFeatureFlag.native.ts');
    const entrySource = `${nativeSurfaceSource}\n${featureFlagSource}`;

    expect(nativeSurfaceSource).toContain(
      "import { HomePageView } from './pages/HomePageView';",
    );
    expect(entrySource).not.toMatch(/from ['"]\.\/NativeHomePage['"]/);
    expect(entrySource).not.toContain('@onekeyhq/native-components');
    expect(entrySource).not.toContain('isHomeContainerAvailable');
  });

  it('has no production Home module importing legacy NativeHomePage', () => {
    const legacyImportPattern =
      /(?:from\s+|import\(\s*)['"][^'"]*\/NativeHomePage['"]/;
    const legacyImporters = listProductionSourceFiles(__dirname)
      .filter((filePath) => legacyImportPattern.test(readSource(filePath)))
      .map((filePath) => path.relative(__dirname, filePath));

    expect(legacyImporters).toEqual([]);
  });

  it('physically retires the old Native business host and source adapters', () => {
    const retiredFiles = [
      'NativeHomePage.native.tsx',
      'NativeHomePage.tsx',
      'NativeHomePage.types.ts',
      'useNativeHomeBannersData.ts',
      'useNativeHomeDeFiData.ts',
      'useNativeHomeHistoryData.ts',
      'useNativeHomeLpTokenData.ts',
      'useNativeHomeNFTData.ts',
      'useNativeHomePortfolioData.ts',
      'useNativeHomeSupplementalData.ts',
    ];

    retiredFiles.forEach((fileName) => {
      expect(fs.existsSync(path.join(__dirname, fileName))).toBe(false);
    });
  });

  it('keeps the developer flag contract without consulting HomeContainer', () => {
    expect(isNativeHomeEnabled()).toBe(true);
    expect(isNativeHomeEnabled(true)).toBe(true);
    expect(isNativeHomeEnabled(false)).toBe(false);
  });
});
