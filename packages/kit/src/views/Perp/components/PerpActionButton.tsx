import { Button, SizableText } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';

import { getPerpActionButtonStyleProps } from '../utils/styleUtils';

import type { IPerpActionButtonVariant } from '../utils/styleUtils';

type IPerpActionButtonProps = Omit<
  IButtonProps,
  | 'children'
  | 'childrenAsText'
  | 'variant'
  | 'bg'
  | 'backgroundColor'
  | 'color'
  | 'iconColor'
  | 'hoverStyle'
  | 'pressStyle'
> & {
  variant: IPerpActionButtonVariant;
  children: string;
};

export function PerpActionButton({
  variant,
  children,
  disabled,
  testID,
  ...props
}: IPerpActionButtonProps) {
  const { textColor, ...styles } = getPerpActionButtonStyleProps(variant);
  return (
    <Button
      {...props}
      testID={testID}
      disabled={disabled}
      variant={variant}
      {...styles}
      childrenAsText={false}
    >
      <SizableText
        size="$bodyLgMedium"
        color={textColor}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {children}
      </SizableText>
    </Button>
  );
}
