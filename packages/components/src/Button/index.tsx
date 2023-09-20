import { cloneElement, useContext } from 'react';

import {
  Stack,
  createStyledContext,
  getTokens,
  styled,
  useTheme,
  withStaticProperties,
} from 'tamagui';

import { Text } from '../Text';

import type { UseThemeResult } from '@tamagui/web/src/hooks/useTheme';

export const ButtonContext = createStyledContext<{
  size: 'small' | 'medium' | 'large';
  buttonVariant: 'secondary' | 'tertiary' | 'primary' | 'destructive';
  disabled: boolean;
}>({
  size: 'medium',
  buttonVariant: 'secondary',
  disabled: false,
});

const ButtonFrame = styled(Stack, {
  name: 'Button',
  tag: 'button',
  role: 'button',
  focusable: true,
  context: ButtonContext,

  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '$2',
  borderWidth: '$px',
  borderStyle: 'solid',
  borderColor: '$transparent',
  space: '$2',

  hoverStyle: {
    backgroundColor: '$bgHover',
  },
  pressStyle: {
    backgroundColor: '$bgActive',
  },
  focusStyle: {
    outlineColor: '$focusRing',
    outlineStyle: 'solid',
    outlineWidth: 2,
  },

  variants: {
    size: {
      small: {
        paddingVertical: '$1',
        paddingHorizontal: '$2.5',
      },
      medium: {
        paddingVertical: '$1.5',
        paddingHorizontal: '$3.5',
      },
      large: {
        paddingVertical: '$3',
        paddingHorizontal: '$5',
      },
    },
    buttonVariant: {
      primary: {
        backgroundColor: '$bgPrimary',
        hoverStyle: {
          backgroundColor: '$bgPrimaryHover',
        },
        pressStyle: {
          backgroundColor: '$bgPrimaryActive',
        },
      },
      secondary: {
        backgroundColor: '$bgStrong',
      },
      tertiary: {
        backgroundColor: '$transparent',
        borderWidth: '$0',
        paddingVertical: '$1',
        paddingHorizontal: '$2.5',
        marginVertical: '$-1',
        marginHorizontal: '$-2.5',
      },
      destructive: {
        backgroundColor: '$bgCriticalStrong',
        hoverStyle: {
          backgroundColor: '$bgCriticalStrongHover',
        },
        pressStyle: {
          backgroundColor: '$bgCriticalStrongActive',
        },
        focusStyle: {
          outlineColor: '$focusRingCritical',
        },
      },
    },
    disabled: {
      true: {
        pointerEvents: 'none',
        focusable: undefined,
        focusStyle: {
          outlineColor: '$transparent',
        },
        opacity: 0.5,
      },
    },
  } as const,
});

export const ButtonText = styled(Text, {
  name: 'ButtonText',
  userSelect: 'none',
  context: ButtonContext,

  variant: '$bodyLgMedium',

  variants: {
    size: {
      small: {
        variant: '$bodyMdMedium',
      },
    },
    buttonVariant: {
      primary: {
        color: '$textInverse',
      },
      secondary: {
        color: '$text',
      },
      tertiary: {
        color: '$textSubdued',
      },
      destructive: {
        color: '$textOnColor',
      },
    },
  } as const,
});

const colorMapping: Record<string, keyof UseThemeResult> = {
  primary: '$iconInverse',
  secondary: '$icon',
  tertiary: '$iconSubdued',
  destructive: '$iconOnColor',
};
const ButtonIcon = ({ children }: React.PropsWithChildren<unknown>) => {
  const { size, buttonVariant } = useContext(ButtonContext);
  const tokens = getTokens({ prefixed: false });
  const theme = useTheme();
  const iconSize =
    size === 'small' ? tokens.size['5'].val * 0.9 : tokens.size['5'].val;
  type ThemeKey = keyof typeof theme;
  const key: ThemeKey = colorMapping[buttonVariant] as ThemeKey;
  return children
    ? cloneElement(children as React.ReactElement, {
        width: iconSize,
        height: iconSize,
        color: theme[key].get(),
      })
    : null;
};

export const Button = withStaticProperties(ButtonFrame, {
  Props: ButtonContext.Provider,
  Text: ButtonText,
  Icon: ButtonIcon,
});
