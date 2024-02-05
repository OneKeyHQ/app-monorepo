import type {
  IButtonProps,
  IHeadingProps,
  IXStackProps,
} from '@onekeyhq/components';
import { Button, Heading, XStack } from '@onekeyhq/components';

type ISectionHeadingProps = {
  selected?: boolean;
};

function SectionHeading({
  selected,
  children,
  ...rest
}: ISectionHeadingProps & IHeadingProps) {
  return (
    <Heading
      size="$headingLg"
      py="$2.5"
      {...(!selected && {
        opacity: 0.5,
      })}
      {...rest}
    >
      {children}
    </Heading>
  );
}

function SectionButton({ children, ...rest }: IButtonProps) {
  return (
    <Button size="medium" variant="tertiary" ml="auto" {...rest}>
      {children}
    </Button>
  );
}

export function DashboardSectionHeader({ children, ...rest }: IXStackProps) {
  return (
    <XStack
      alignItems="center"
      space="$5"
      userSelect="none"
      $gtMd={{
        pt: '$1',
        mt: '$1',
        borderTopWidth: 1,
        borderColor: '$borderSubdued',
      }}
      {...rest}
    >
      {children}
    </XStack>
  );
}

DashboardSectionHeader.Heading = SectionHeading;
DashboardSectionHeader.Button = SectionButton;
