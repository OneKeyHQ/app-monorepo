import { useState } from 'react';

import {
  IconButton,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';

import { DataViewer } from './DataViewer';

type IProps = {
  dataGroup: {
    title: string;
    data: string;
  }[];
  showEmptyData?: boolean;
  showCopy?: boolean;
};

function DataViewerTab(props: IProps) {
  const { dataGroup, showEmptyData, showCopy } = props;
  const { copyText } = useClipboard();
  const [activeDataGroupIndex, setActiveDataGroupIndex] = useState(0);

  const items = showEmptyData
    ? dataGroup
    : dataGroup.filter((item) => item.data);

  return (
    <YStack gap="$2.5">
      <XStack>
        <XStack gap="$4" flex={1}>
          {items.map((item, index) => (
            <YStack
              key={item.title}
              px="$1"
              mx="$-1"
              userSelect="none"
              borderRadius="$1"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusable
              focusVisibleStyle={{
                outlineColor: '$focusRing',
                outlineWidth: 2,
                outlineStyle: 'solid',
                outlineOffset: 0,
              }}
              onPress={() => {
                setActiveDataGroupIndex(index);
              }}
            >
              <SizableText
                size={
                  activeDataGroupIndex === index ? '$bodyMdMedium' : '$bodyMd'
                }
                color={
                  activeDataGroupIndex === index ? '$text' : '$textSubdued'
                }
              >
                {item.title}
              </SizableText>
            </YStack>
          ))}
        </XStack>
        {showCopy ? (
          <IconButton
            variant="tertiary"
            icon="Copy3Outline"
            size="small"
            onPress={() => {
              copyText(items[activeDataGroupIndex].data);
            }}
          />
        ) : null}
      </XStack>
      <DataViewer
        key={activeDataGroupIndex}
        data={items[activeDataGroupIndex].data}
      />
    </YStack>
  );
}

export { DataViewerTab };
