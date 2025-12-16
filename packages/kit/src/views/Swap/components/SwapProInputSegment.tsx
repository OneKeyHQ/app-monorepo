import { Fragment } from 'react';

import { Button, Divider, SizableText, XStack } from '@onekeyhq/components';

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
      {items.map((item, index) => {
        const text = item.label ?? item.value;
        return (
          <Fragment key={`${item.value}-${index}`}>
            <Button
              onPress={() => onSelect(item.value)}
              size="small"
              py="$1.5"
              px="$1"
              backgroundColor="$transparent"
              borderTopLeftRadius={0}
              borderTopRightRadius={0}
              borderBottomRightRadius={index !== items.length - 1 ? 0 : '$2'}
              borderBottomLeftRadius={index !== 0 ? 0 : '$2'}
              flex={1}
              minWidth={0}
            >
              <SizableText size="$bodyMd" numberOfLines={1}>
                {text}
              </SizableText>
            </Button>
            {index !== items.length - 1 ? <Divider vertical /> : null}
          </Fragment>
        );
      })}
    </XStack>
  );
};

export default SwapProInputSegment;
