import { Button, Divider, XStack } from '@onekeyhq/components';

interface ISwapProInputSegmentProps {
  items: { label?: string; value: string }[];
  onSelect: (value: string) => void;
}

const SwapProInputSegment = ({
  items,
  onSelect,
}: ISwapProInputSegmentProps) => {
  if (items.length === 0) {
    return null;
  }
  return (
    <XStack borderBottomLeftRadius="$2" borderBottomRightRadius="$2" flex={1}>
      {items.map((item, index) => (
        <>
          <Button
            key={`${item.value}-${index}`}
            onPress={() => onSelect(item.value)}
            size="medium"
            backgroundColor="$transparent"
            borderTopLeftRadius={0}
            borderTopRightRadius={0}
            borderBottomRightRadius={index !== items.length - 1 ? 0 : '$2'}
            borderBottomLeftRadius={index !== 0 ? 0 : '$2'}
            flex={1}
          >
            {item.label ?? item.value}
          </Button>
          {index !== items.length - 1 ? <Divider vertical /> : null}
        </>
      ))}
    </XStack>
  );
};

export default SwapProInputSegment;
