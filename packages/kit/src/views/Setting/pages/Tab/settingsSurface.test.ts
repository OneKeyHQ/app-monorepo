import {
  isVisibleSubSettingsItem,
  resolveSettingsHeaderBackgroundTokenKey,
  resolveSettingsPageBackgroundTokenKey,
  resolveSettingsSectionPresentation,
  resolveSettingsSectionSurface,
} from './settingsSurface';

describe('resolveSettingsHeaderBackgroundTokenKey', () => {
  it('uses the grouped page token when present', () => {
    expect(
      resolveSettingsHeaderBackgroundTokenKey({
        isNativeIOS: false,
        pageBackgroundTokenKey: 'bgSubdued',
      }),
    ).toBe('bgSubdued');
  });

  it('uses the app canvas when a custom Web or Android header becomes flat', () => {
    expect(
      resolveSettingsHeaderBackgroundTokenKey({
        isNativeIOS: false,
        pageBackgroundTokenKey: undefined,
      }),
    ).toBe('bgApp');
  });

  it('preserves the inherited native iOS header on flat layouts', () => {
    expect(
      resolveSettingsHeaderBackgroundTokenKey({
        isNativeIOS: true,
        pageBackgroundTokenKey: undefined,
      }),
    ).toBeUndefined();
  });
});

describe('resolveSettingsPageBackgroundTokenKey', () => {
  it.each([
    {
      name: 'light theme',
      input: { enabled: true, themeName: 'light' },
      expected: 'bgSubdued',
    },
    {
      name: 'dark theme',
      input: { enabled: true, themeName: 'dark' },
      expected: 'bgApp',
    },
    {
      name: 'named dark theme',
      input: { enabled: true, themeName: 'dark_brand' },
      expected: 'bgApp',
    },
    {
      name: 'disabled grouped surface',
      input: { enabled: false, themeName: 'light' },
      expected: undefined,
    },
  ])('uses the correct page surface for $name', ({ input, expected }) => {
    expect(resolveSettingsPageBackgroundTokenKey(input)).toBe(expected);
  });
});

describe('resolveSettingsSectionPresentation', () => {
  it.each([
    {
      name: 'phone',
      input: {
        isMobileLayout: true,
        isNative: true,
        isTabNavigator: false,
      },
      expected: 'mobile',
    },
    {
      name: 'desktop or wide web',
      input: {
        isMobileLayout: false,
        isNative: false,
        isTabNavigator: true,
      },
      expected: 'tab',
    },
    {
      name: 'native iPad',
      input: {
        isMobileLayout: false,
        isNative: true,
        isTabNavigator: true,
      },
      expected: 'flat',
    },
    {
      name: 'extension or narrow web',
      input: {
        isMobileLayout: false,
        isNative: false,
        isTabNavigator: false,
      },
      expected: 'flat',
    },
  ])('uses the $expected surface for $name', ({ input, expected }) => {
    expect(resolveSettingsSectionPresentation(input)).toBe(expected);
  });
});

describe('isVisibleSubSettingsItem', () => {
  it.each([
    {
      name: 'hides desktopTab items on the tab navigator',
      input: {
        hasDesktopTab: true,
        isMobileHome: false,
        isTabNavigator: true,
        isMobileLayout: false,
      },
      expected: false,
    },
    {
      name: 'keeps desktopTab items on extension or narrow web',
      input: {
        hasDesktopTab: true,
        isMobileHome: false,
        isTabNavigator: false,
        isMobileLayout: false,
      },
      expected: true,
    },
    {
      name: 'hides mobileHome items on the phone category page',
      input: {
        hasDesktopTab: false,
        isMobileHome: true,
        isTabNavigator: false,
        isMobileLayout: true,
      },
      expected: false,
    },
    {
      name: 'keeps ordinary items on every host',
      input: {
        hasDesktopTab: false,
        isMobileHome: false,
        isTabNavigator: true,
        isMobileLayout: false,
      },
      expected: true,
    },
  ])('$name', ({ input, expected }) => {
    expect(isVisibleSubSettingsItem(input)).toBe(expected);
  });
});

describe('resolveSettingsSectionSurface', () => {
  it.each([
    {
      presentation: 'mobile' as const,
      expected: {
        backgroundColor: '$bg',
        borderColor: '$neutral3',
        borderWidthScale: 0,
        borderRadius: '$4',
        borderCurve: undefined,
      },
    },
    {
      presentation: 'tab' as const,
      expected: {
        backgroundColor: '$bg',
        borderColor: '$neutral3',
        borderWidthScale: 0.5,
        borderRadius: '$3',
        borderCurve: 'continuous',
      },
    },
    {
      presentation: 'flat' as const,
      expected: {
        backgroundColor: '$bgSubdued',
        borderColor: '$neutral3',
        borderWidthScale: 1,
        borderRadius: '$2.5',
        borderCurve: undefined,
      },
    },
  ])(
    'resolves the $presentation section hierarchy',
    ({ presentation, expected }) => {
      expect(resolveSettingsSectionSurface(presentation)).toEqual(expected);
    },
  );
});
