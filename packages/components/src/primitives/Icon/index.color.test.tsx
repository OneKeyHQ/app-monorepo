/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';

import { Icon } from '.';

import { render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IIconContainerProps } from '.';
import type { TextStyle } from 'react-native';

const mockOneKeyIcon = jest.fn<null, [object]>(() => null);

jest.mock('@onekeyfe/react-native-image/icon', () => ({
  OneKeyIcon: (props: object) => mockOneKeyIcon(props),
}));

jest.mock('react-native', () => ({ I18nManager: { isRTL: false } }));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));

jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  styled: (component: object) => component,
  useTheme: () => ({ icon: { val: '#123456' } }),
  withStaticProperties: (component: object, properties: object) =>
    Object.assign(component, properties),
}));

jest.mock('../Stack', () => ({
  Stack: ({ children }: { children?: ReactNode }) => children,
}));

// Bypass styled() so each case exercises the resolved color at the SDK boundary.
const IconContainer = Icon as React.ComponentType<IIconContainerProps>;
const nativeColorCases: [TextStyle, string][] = [
  [{ color: 'white' }, 'rgba(255,255,255,1)'],
  [{ color: 'rebeccapurple' }, 'rgba(102,51,153,1)'],
  [{ color: 'transparent' }, 'rgba(0,0,0,0)'],
  [{ color: '#123456' }, 'rgba(18,52,86,1)'],
  [{ color: '#fff8' }, `rgba(255,255,255,${136 / 255})`],
  [{ color: 'rgb(12, 34, 56)' }, 'rgba(12,34,56,1)'],
  [{ color: 'rgba(12, 34, 56, 0.5)' }, `rgba(12,34,56,${128 / 255})`],
  [{ color: 'hsl(120, 100%, 50%)' }, 'rgba(0,255,0,1)'],
];
const webIconStyle = { color: 'white' };

describe('Icon color adapter', () => {
  beforeEach(() => {
    mockOneKeyIcon.mockClear();
    platformEnv.isNative = true;
  });

  it.each(nativeColorCases)(
    'passes %j to the native SDK as RGBA',
    (style, expected) => {
      render(<IconContainer name="OpenOutline" style={style} />);

      expect(mockOneKeyIcon).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: 'OpenOutline', color: expected }),
      );
    },
  );

  it('uses the theme color when no style color is set', () => {
    render(<IconContainer name="OpenOutline" />);

    expect(mockOneKeyIcon).toHaveBeenLastCalledWith(
      expect.objectContaining({ color: 'rgba(18,52,86,1)' }),
    );
  });

  it('keeps web icons inheriting their CSS color', () => {
    platformEnv.isNative = false;
    render(<IconContainer name="OpenOutline" style={webIconStyle} />);

    expect(mockOneKeyIcon).toHaveBeenLastCalledWith(
      expect.objectContaining({ color: 'inherit' }),
    );
  });
});
