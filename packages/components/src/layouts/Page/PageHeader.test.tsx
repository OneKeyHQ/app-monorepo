/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react';

const mockSetOptions = jest.fn();
const explicitHeaderStyle = { backgroundColor: '#191919' };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    setOptions: mockSetOptions,
  }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeIOS: false,
  },
}));

jest.mock('../../hocs', () => ({
  useIsOverlayPage: () => false,
}));

jest.mock('../../hooks', () => ({
  useTheme: () => ({
    text: {
      val: '#000000',
    },
  }),
}));

jest.mock('../../primitives/Button/GlassHeaderContext', () => ({
  toNoGlassHeaderItems: () => undefined,
  wrapHeaderRenderInGlass: (renderHeader: unknown) => renderHeader,
}));

jest.mock('../Navigation/Header/HeaderSearchBar', () => () => null);

const { PageHeader } = require('./PageHeader') as typeof import('./PageHeader');

describe('PageHeader', () => {
  beforeEach(() => {
    mockSetOptions.mockClear();
  });

  it('preserves the navigator header style when the page does not override it', () => {
    render(<PageHeader title="Settings" />);

    expect(mockSetOptions).toHaveBeenCalledTimes(1);
    expect(mockSetOptions.mock.calls[0][0]).not.toHaveProperty('headerStyle');
  });

  it('forwards an explicit page header style', () => {
    render(<PageHeader headerStyle={explicitHeaderStyle} />);

    expect(mockSetOptions.mock.calls[0][0]).toEqual(
      expect.objectContaining({ headerStyle: explicitHeaderStyle }),
    );
  });

  it('forces a transparent background for transparent headers', () => {
    render(<PageHeader headerTransparent />);

    expect(mockSetOptions.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        headerStyle: [{}, { backgroundColor: 'transparent' }],
      }),
    );
  });
});
