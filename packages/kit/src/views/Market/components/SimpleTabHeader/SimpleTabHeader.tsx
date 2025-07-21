import { useCallback } from 'react';

import { Button, SizableText, Stack, XStack } from '@onekeyhq/components';

import type { ISimpleTabHeaderProps, ITabItem } from './types';

export function SimpleTabHeader<T = string>({
  data,
  activeIndex,
  onTabPress,
  renderTitle,
  containerProps,
  size = 'small',
  gap = '$2',
}: ISimpleTabHeaderProps<T>) {
  const handleTabPress = useCallback(
    (index: number, tabId: T) => {
      onTabPress(index, tabId);
    },
    [onTabPress],
  );

  const renderTabButton = useCallback(
    (item: ITabItem<T>, index: number) => {
      const isActive = index === activeIndex;

      const renderContent = () => {
        if (renderTitle) {
          const titleContent = renderTitle(item, index, isActive);
          if (typeof titleContent === 'string') {
            return (
              <SizableText
                size="$bodyMdMedium"
                color={isActive ? '$textSubdued' : '$text'}
              >
                {titleContent}
              </SizableText>
            );
          }
          return <Stack>{titleContent}</Stack>;
        }
        return (
          <SizableText
            size="$bodyMdMedium"
            color={isActive ? '$textSubdued' : '$text'}
          >
            {item.title}
          </SizableText>
        );
      };

      return (
        <Button
          key={item.id as string}
          variant="tertiary"
          size={size}
          disabled={item.disabled}
          onPress={() => handleTabPress(index, item.id)}
          mr={index < data.length - 1 ? '$5' : '$0'}
          borderBottomWidth="$0.5"
          borderBottomColor={isActive ? '$borderInteractive' : 'transparent'}
          opacity={isActive ? 1 : 0.6}
          bg="transparent"
        >
          {renderContent()}
        </Button>
      );
    },
    [activeIndex, renderTitle, handleTabPress, size, data.length],
  );

  return (
    <XStack
      px="$5"
      py="$3"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      {...containerProps}
    >
      {data.map(renderTabButton)}
    </XStack>
  );
}
