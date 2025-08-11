import {
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';

interface IPreSwapInfoItemProps {
  ifPopover?: boolean;
  popoverContent?: string | React.ReactNode;
  title: string;
  value: string | React.ReactNode;
}

const PreSwapInfoItem = ({
  ifPopover = false,
  popoverContent,
  title,
  value,
}: IPreSwapInfoItemProps) => {
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <XStack alignItems="center" gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {title}
        </SizableText>
        {ifPopover ? (
          <Popover
            title={title}
            renderTrigger={
              <Icon
                cursor="pointer"
                name="InfoCircleOutline"
                size="$3.5"
                color="$iconSubdued"
              />
            }
            renderContent={() => {
              return (
                <Stack p="$4">
                  <SizableText size="$bodyMd" color="$text">
                    {popoverContent}
                  </SizableText>
                </Stack>
              );
            }}
          />
        ) : null}
      </XStack>
      {typeof value === 'string' ? (
        <SizableText size="$bodyMd">{value}</SizableText>
      ) : (
        value
      )}
    </XStack>
  );
};

export default PreSwapInfoItem;
