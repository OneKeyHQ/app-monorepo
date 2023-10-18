import type { PropsWithChildren } from 'react';
import { Children, useContext } from 'react';

import {
  AnimatePresence,
  createStyledContext,
  styled,
  withStaticProperties,
} from 'tamagui';

import { Icon } from '../Icon';
import { Spinner } from '../Spinner';
import { Stack } from '../Stack';
import { Text } from '../Text';

import type { ICON_NAMES, IconProps } from '../Icon';
import type { ColorTokens, GetProps, StackProps } from 'tamagui';

export const ButtonContext = createStyledContext<{
  size: 'small' | 'medium' | 'large';
  buttonVariant: 'secondary' | 'tertiary' | 'primary' | 'destructive';
}>({
  size: 'medium',
  buttonVariant: 'secondary',
});

const ButtonText = styled(Text, {
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

function ButtonStack({ children, ...restProps }: PropsWithChildren<unknown>) {
  const { buttonVariant } = useContext(ButtonContext);
  return (
    <Stack {...restProps}>
      {Children.map(children, (child) =>
        typeof child === 'string' ? (
          <ButtonText buttonVariant={buttonVariant}>{child}</ButtonText>
        ) : (
          child
        ),
      )}
    </Stack>
  );
}

export const ButtonFrame = styled(Stack, {
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
        borderRadius: '$3',
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

const iconColorMapping: Record<string, ColorTokens> = {
  primary: '$iconInverse',
  secondary: '$icon',
  tertiary: '$iconSubdued',
  destructive: '$iconOnColor',
};

const ButtonIcon = ({ name, ...props }: IconProps) => {
  const { size, buttonVariant } = useContext(ButtonContext);
  if (!name) {
    return null;
  }
  return (
    <Icon
      name={name}
      color={iconColorMapping[buttonVariant]}
      size={size === 'small' ? '$4.5' : '$5'}
      {...props}
    />
  );
};

const ButtonSpinner = (props: StackProps) => {
  const { size, buttonVariant } = useContext(ButtonContext);

  return (
    <Stack padding={size === 'large' ? '$0.5' : '$0'} {...props}>
      <Spinner color={iconColorMapping[buttonVariant]} size="small" />
    </Stack>
  );
};

type ButtonActionProps = GetProps<typeof ButtonFrame> & {
  iconName?: ICON_NAMES;
  text?: string;
  spinning?: boolean;
};

const ButtonAction = ({
  iconName,
  spinning,
  text,
  disabled,
  ...restProps
}: ButtonActionProps) => (
  <ButtonFrame {...restProps} disabled={disabled || spinning}>
    <AnimatePresence>
      {spinning ? (
        <ButtonSpinner
          size="small"
          animation="quick"
          enterStyle={{
            scale: 0.9,
          }}
          pressStyle={{
            scale: 0.9,
          }}
          hoverStyle={{
            scale: 0.9,
          }}
          exitStyle={{
            scale: 0.9,
          }}
        />
      ) : (
        <ButtonIcon name={iconName} />
      )}
    </AnimatePresence>
    <ButtonText>{text}</ButtonText>
  </ButtonFrame>
);

export const Button = withStaticProperties(ButtonFrame, {
  Props: ButtonContext.Provider,
  Text: ButtonText,
  Icon: ButtonIcon,
  Spinner: ButtonSpinner,
  Action: ButtonAction,
});
