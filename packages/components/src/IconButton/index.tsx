import { useContext } from 'react';

import { styled, withStaticProperties } from 'tamagui';

import { ButtonContext, ButtonFrame } from '../Button';
import { Icon } from '../Icon';
import { Spinner } from '../Spinner';
import { Stack } from '../Stack';

import type { IconProps } from '../Icon';
import type { ColorTokens } from 'tamagui';

const IconButtonFrame = styled(ButtonFrame, {
  name: 'IconButton',
  context: ButtonContext,
  borderRadius: '$full',

  variants: {
    size: {
      small: {
        padding: '$1',
      },
      medium: {
        padding: '$1.5',
      },
      large: {
        padding: '$3',
        borderRadius: '$full',
      },
    },

    buttonVariant: {
      secondary: {},
      tertiary: {
        padding: '$2',
        margin: '$-2',
      },
      primary: {},
      destructive: {},
    },
  } as const,
});

const iconColorMapping: Record<string, ColorTokens> = {
  primary: '$iconInverse',
  secondary: '$icon',
  tertiary: '$iconSubdued',
  destructive: '$iconOnColor',
};

export const IconButtonIcon = (props: IconProps) => {
  const { size, buttonVariant } = useContext(ButtonContext);

  return (
    <Icon
      color={iconColorMapping[buttonVariant]}
      size={size === 'small' ? '$5' : '$6'}
      {...props}
    />
  );
};

export const IconButtonSpinner = () => {
  const { size, buttonVariant } = useContext(ButtonContext);

  return (
    <Stack padding={size !== 'small' ? '$0.5' : '$0'}>
      <Spinner color={iconColorMapping[buttonVariant]} />
    </Stack>
  );
};

export const IconButton = withStaticProperties(IconButtonFrame, {
  Props: ButtonContext.Provider,
  Icon: IconButtonIcon,
  Spinner: IconButtonSpinner,
});
