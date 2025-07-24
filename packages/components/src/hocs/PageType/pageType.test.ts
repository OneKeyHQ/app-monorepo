import { EPageType } from './pageType';

describe('EPageType enum', () => {
  describe('enum values', () => {
    test('should have modal value equal to "modal"', () => {
      expect(EPageType.modal).toBe('modal');
    });

    test('should have fullScreen value equal to "fullScreen"', () => {
      expect(EPageType.fullScreen).toBe('fullScreen');
    });

    test('should have stack value equal to "stack"', () => {
      expect(EPageType.stack).toBe('stack');
    });
  });

  describe('enum completeness', () => {
    test('should contain exactly 3 values', () => {
      const enumValues = Object.values(EPageType);
      expect(enumValues).toHaveLength(3);
    });

    test('should contain all expected values', () => {
      const enumValues = Object.values(EPageType);
      expect(enumValues).toEqual(
        expect.arrayContaining(['modal', 'fullScreen', 'stack']),
      );
    });

    test('should have keys matching their values (string enum)', () => {
      expect(EPageType.modal).toBe('modal');
      expect(EPageType.fullScreen).toBe('fullScreen');
      expect(EPageType.stack).toBe('stack');
    });
  });

  describe('enum keys and properties', () => {
    test('should have correct enum keys', () => {
      const enumKeys = Object.keys(EPageType);
      expect(enumKeys).toEqual(['modal', 'fullScreen', 'stack']);
    });

    test('should be accessible via bracket notation', () => {
      expect(EPageType.modal).toBe('modal');
      expect(EPageType.fullScreen).toBe('fullScreen');
      expect(EPageType.stack).toBe('stack');
    });

    test('should maintain consistent key-value ordering', () => {
      const entries = Object.entries(EPageType);
      expect(entries[0]).toEqual(['modal', 'modal']);
      expect(entries[1]).toEqual(['fullScreen', 'fullScreen']);
      expect(entries[2]).toEqual(['stack', 'stack']);
    });
  });

  describe('type safety and validation', () => {
    test('should work with type guards', () => {
      const isValidPageType = (value: string): value is EPageType => {
        return Object.values(EPageType).includes(value as EPageType);
      };

      expect(isValidPageType('modal')).toBe(true);
      expect(isValidPageType('fullScreen')).toBe(true);
      expect(isValidPageType('stack')).toBe(true);
      expect(isValidPageType('invalid')).toBe(false);
      expect(isValidPageType('')).toBe(false);
      expect(isValidPageType('Modal')).toBe(false);
    });

    test('should work correctly in switch statements', () => {
      const getPageTypeDescription = (pageType: EPageType): string => {
        switch (pageType) {
          case EPageType.modal:
            return 'Modal page displays content in an overlay';
          case EPageType.fullScreen:
            return 'Full screen page takes entire viewport';
          case EPageType.stack:
            return 'Stack page is part of navigation stack';
          default: {
            const exhaustiveCheck: never = pageType;
            return exhaustiveCheck;
          }
        }
      };

      expect(getPageTypeDescription(EPageType.modal)).toBe(
        'Modal page displays content in an overlay',
      );
      expect(getPageTypeDescription(EPageType.fullScreen)).toBe(
        'Full screen page takes entire viewport',
      );
      expect(getPageTypeDescription(EPageType.stack)).toBe(
        'Stack page is part of navigation stack',
      );
    });

    test('should work in array operations', () => {
      const pageTypes = [EPageType.modal, EPageType.fullScreen, EPageType.stack];

      expect(pageTypes).toContain(EPageType.modal);
      expect(pageTypes).toContain(EPageType.fullScreen);
      expect(pageTypes).toContain(EPageType.stack);

      const nonModalTypes = pageTypes.filter((type) => type !== EPageType.modal);
      expect(nonModalTypes).toEqual([EPageType.fullScreen, EPageType.stack]);
      expect(nonModalTypes).toHaveLength(2);
    });
  });

  describe('serialization and JSON operations', () => {
    test('should serialize to JSON correctly', () => {
      const pageConfig = {
        primaryType: EPageType.modal,
        secondaryType: EPageType.fullScreen,
        fallbackType: EPageType.stack,
      };

      const jsonString = JSON.stringify(pageConfig);
      expect(jsonString).toBe(
        '{"primaryType":"modal","secondaryType":"fullScreen","fallbackType":"stack"}',
      );
    });

    test('should deserialize from JSON correctly', () => {
      const jsonString = '{"type":"modal","fallback":"stack"}';
      const parsed = JSON.parse(jsonString);

      expect(parsed.type).toBe(EPageType.modal);
      expect(parsed.fallback).toBe(EPageType.stack);
    });

    test('should handle JSON roundtrip correctly', () => {
      const original = { pageType: EPageType.fullScreen };
      const jsonString = JSON.stringify(original);
      const parsed = JSON.parse(jsonString);

      expect(parsed.pageType).toBe(EPageType.fullScreen);
      expect(parsed.pageType).toBe(original.pageType);
    });
  });

  describe('comparison and equality operations', () => {
    test('should handle strict equality comparisons', () => {
      expect(EPageType.modal === 'modal').toBe(true);
      expect(EPageType.modal === EPageType.fullScreen).toBe(false);
      expect(EPageType.fullScreen === 'fullScreen').toBe(true);
      expect(EPageType.stack === 'stack').toBe(true);
    });

    test('should handle inequality comparisons', () => {
      expect(EPageType.modal !== EPageType.fullScreen).toBe(true);
      expect(EPageType.modal !== EPageType.stack).toBe(true);
      expect(EPageType.fullScreen !== EPageType.stack).toBe(true);
    });

    test('should be case sensitive', () => {
      expect(EPageType.modal).not.toBe('Modal');
      expect(EPageType.modal).not.toBe('MODAL');
      expect(EPageType.fullScreen).not.toBe('fullscreen');
      expect(EPageType.fullScreen).not.toBe('FullScreen');
      expect(EPageType.stack).not.toBe('Stack');
      expect(EPageType.stack).not.toBe('STACK');
    });
  });

  describe('collection operations', () => {
    test('should work with Set operations', () => {
      const pageTypeSet = new Set([
        EPageType.modal,
        EPageType.fullScreen,
        EPageType.modal,
      ]);

      expect(pageTypeSet.size).toBe(2);
      expect(pageTypeSet.has(EPageType.modal)).toBe(true);
      expect(pageTypeSet.has(EPageType.fullScreen)).toBe(true);
      expect(pageTypeSet.has(EPageType.stack)).toBe(false);

      pageTypeSet.add(EPageType.stack);
      expect(pageTypeSet.size).toBe(3);
      expect(pageTypeSet.has(EPageType.stack)).toBe(true);
    });

    test('should work with Map operations', () => {
      const pageTypeMap = new Map([
        [EPageType.modal, { hasOverlay: true, closable: true }],
        [EPageType.fullScreen, { hasOverlay: false, closable: false }],
        [EPageType.stack, { hasOverlay: false, closable: true }],
      ]);

      expect(pageTypeMap.get(EPageType.modal)).toEqual({
        hasOverlay: true,
        closable: true,
      });
      expect(pageTypeMap.get(EPageType.fullScreen)).toEqual({
        hasOverlay: false,
        closable: false,
      });
      expect(pageTypeMap.get(EPageType.stack)).toEqual({
        hasOverlay: false,
        closable: true,
      });
      expect(pageTypeMap.size).toBe(3);
    });

    test('should work as object keys', () => {
      const pageTypeConfig = {
        [EPageType.modal]: { zIndex: 1000, backdrop: true },
        [EPageType.fullScreen]: { zIndex: 1, backdrop: false },
        [EPageType.stack]: { zIndex: 10, backdrop: false },
      };

      expect(pageTypeConfig[EPageType.modal]).toEqual({
        zIndex: 1000,
        backdrop: true,
      });
      expect(pageTypeConfig[EPageType.fullScreen]).toEqual({
        zIndex: 1,
        backdrop: false,
      });
      expect(pageTypeConfig[EPageType.stack]).toEqual({
        zIndex: 10,
        backdrop: false,
      });
    });
  });

  describe('string operations', () => {
    test('should handle string concatenation', () => {
      const prefix = 'page-type-';
      expect(prefix + EPageType.modal).toBe('page-type-modal');
      expect(prefix + EPageType.fullScreen).toBe('page-type-fullScreen');
      expect(prefix + EPageType.stack).toBe('page-type-stack');
    });

    test('should work with template literals', () => {
      const getClassName = (type: EPageType) => `onekey-page-${type}`;

      expect(getClassName(EPageType.modal)).toBe('onekey-page-modal');
      expect(getClassName(EPageType.fullScreen)).toBe('onekey-page-fullScreen');
      expect(getClassName(EPageType.stack)).toBe('onekey-page-stack');
    });

    test('should work with string methods', () => {
      expect(EPageType.modal.toUpperCase()).toBe('MODAL');
      expect(EPageType.fullScreen.toLowerCase()).toBe('fullscreen');
      expect(EPageType.stack.charAt(0)).toBe('s');
      expect(EPageType.fullScreen.includes('Screen')).toBe(true);
      expect(EPageType.modal.startsWith('mod')).toBe(true);
    });
  });

  describe('functional programming operations', () => {
    test('should work with Array.map()', () => {
      const allTypes = Object.values(EPageType);
      const upperCaseTypes = allTypes.map((type) => type.toUpperCase());

      expect(upperCaseTypes).toEqual(['MODAL', 'FULLSCREEN', 'STACK']);
    });

    test('should work with Array.filter()', () => {
      const allTypes = Object.values(EPageType);
      const typesWithCapitalLetters = allTypes.filter((type) =>
        /[A-Z]/.test(type),
      );

      expect(typesWithCapitalLetters).toEqual(['fullScreen']);
    });

    test('should work with Array.reduce()', () => {
      const allTypes = Object.values(EPageType);
      const lengthMap = allTypes.reduce((acc, type) => {
        acc[type] = type.length;
        return acc;
      }, {} as Record<string, number>);

      expect(lengthMap).toEqual({
        modal: 5,
        fullScreen: 10,
        stack: 5,
      });
    });

    test('should work with Array.find()', () => {
      const allTypes = Object.values(EPageType);
      const longestType = allTypes.find((type) => type.length > 8);
      const shortType = allTypes.find((type) => type.length <= 5);

      expect(longestType).toBe('fullScreen');
      expect(shortType).toBe('modal');
    });
  });

  describe('runtime validation and edge cases', () => {
    test('should validate enum values at runtime with comprehensive type checking', () => {
      const validatePageType = (value: unknown): value is EPageType => (
        typeof value === 'string' &&
        Object.values(EPageType).includes(value as EPageType)
      );

      // Valid cases
      expect(validatePageType(EPageType.modal)).toBe(true);
      expect(validatePageType('modal')).toBe(true);
      expect(validatePageType('fullScreen')).toBe(true);
      expect(validatePageType('stack')).toBe(true);

      // Invalid cases
      expect(validatePageType('invalid')).toBe(false);
      expect(validatePageType(123)).toBe(false);
      expect(validatePageType(null)).toBe(false);
      expect(validatePageType(undefined)).toBe(false);
      expect(validatePageType({})).toBe(false);
      expect(validatePageType([])).toBe(false);
      expect(validatePageType(true)).toBe(false);
      expect(validatePageType('')).toBe(false);
    });

    test('should handle default parameter scenarios', () => {
      const createPageConfig = (type: EPageType = EPageType.stack) => ({
        type,
        timestamp: Date.now(),
      });

      const defaultConfig = createPageConfig();
      const modalConfig = createPageConfig(EPageType.modal);
      const fullScreenConfig = createPageConfig(EPageType.fullScreen);

      expect(defaultConfig.type).toBe(EPageType.stack);
      expect(modalConfig.type).toBe(EPageType.modal);
      expect(fullScreenConfig.type).toBe(EPageType.fullScreen);
    });
  });

  describe('enum immutability and consistency', () => {
    test('should maintain immutable enum values', () => {
      const originalModal = EPageType.modal;
      const originalFullScreen = EPageType.fullScreen;
      const originalStack = EPageType.stack;

      // Values should remain consistent across multiple accesses
      expect(EPageType.modal).toBe(originalModal);
      expect(EPageType.fullScreen).toBe(originalFullScreen);
      expect(EPageType.stack).toBe(originalStack);

      // Multiple references should be identical
      expect(EPageType.modal).toBe(EPageType.modal);
      expect(Object.is(EPageType.modal, originalModal)).toBe(true);
    });

    test('should maintain consistent property enumeration', () => {
      const keys1 = Object.keys(EPageType);
      const keys2 = Object.keys(EPageType);
      const values1 = Object.values(EPageType);
      const values2 = Object.values(EPageType);

      expect(keys1).toEqual(keys2);
      expect(values1).toEqual(values2);
      expect(keys1).toEqual(['modal', 'fullScreen', 'stack']);
      expect(values1).toEqual(['modal', 'fullScreen', 'stack']);
    });
  });

  describe('enum introspection and reflection', () => {
    test('should provide complete introspection capabilities', () => {
      const allValues = Object.values(EPageType);
      const allKeys = Object.keys(EPageType);
      const allEntries = Object.entries(EPageType);

      expect(allValues).toHaveLength(3);
      expect(allKeys).toHaveLength(3);
      expect(allEntries).toHaveLength(3);

      // Verify each entry has matching key-value pairs (string enum characteristic)
      allEntries.forEach(([key, value]) => {
        expect(key).toBe(value);
        expect(typeof key).toBe('string');
        expect(typeof value).toBe('string');
      });
    });

    test('should support property existence checks', () => {
      expect(Object.prototype.hasOwnProperty.call(EPageType, 'modal')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(EPageType, 'fullScreen')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(EPageType, 'stack')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(EPageType, 'nonexistent')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(EPageType, 'toString')).toBe(false);
    });

    test('should work with in operator', () => {
      expect('modal' in EPageType).toBe(true);
      expect('fullScreen' in EPageType).toBe(true);
      expect('stack' in EPageType).toBe(true);
      expect('invalid' in EPageType).toBe(false);
    });

    test('should support Object.getOwnPropertyNames', () => {
      const propertyNames = Object.getOwnPropertyNames(EPageType);
      expect(propertyNames).toEqual(['modal', 'fullScreen', 'stack']);
    });
  });

  describe('practical usage scenarios', () => {
    test('should work in conditional rendering logic', () => {
      const shouldShowOverlay = (pageType: EPageType): boolean => {
        return pageType === EPageType.modal;
      };

      const shouldAllowBackNavigation = (pageType: EPageType): boolean => {
        return (
          pageType === EPageType.stack ||
          pageType === EPageType.fullScreen
        );
      };

      expect(shouldShowOverlay(EPageType.modal)).toBe(true);
      expect(shouldShowOverlay(EPageType.fullScreen)).toBe(false);
      expect(shouldShowOverlay(EPageType.stack)).toBe(false);

      expect(shouldAllowBackNavigation(EPageType.modal)).toBe(false);
      expect(shouldAllowBackNavigation(EPageType.fullScreen)).toBe(true);
      expect(shouldAllowBackNavigation(EPageType.stack)).toBe(true);
    });

    test('should work in configuration objects', () => {
      interface PageTypeConfig {
        hasBackButton: boolean;
        hasCloseButton: boolean;
        allowSwipeGestures: boolean;
        zIndex: number;
      }

      const pageConfigs: Record<EPageType, PageTypeConfig> = {
        [EPageType.modal]: {
          hasBackButton: false,
          hasCloseButton: true,
          allowSwipeGestures: false,
          zIndex: 1000,
        },
        [EPageType.fullScreen]: {
          hasBackButton: true,
          hasCloseButton: false,
          allowSwipeGestures: true,
          zIndex: 1,
        },
        [EPageType.stack]: {
          hasBackButton: true,
          hasCloseButton: false,
          allowSwipeGestures: true,
          zIndex: 10,
        },
      };

      expect(pageConfigs[EPageType.modal].hasCloseButton).toBe(true);
      expect(pageConfigs[EPageType.fullScreen].allowSwipeGestures).toBe(true);
      expect(pageConfigs[EPageType.stack].hasBackButton).toBe(true);
      expect(pageConfigs[EPageType.modal].zIndex).toBe(1000);
    });
  });
});