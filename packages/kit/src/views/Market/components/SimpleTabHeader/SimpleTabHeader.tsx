import { useCallback } from 'react';

import { ButtonFrame, SizableText, Stack, XStack } from '@onekeyhq/components';

import type { ISimpleTabHeaderProps, ITabItem } from './types';

export function SimpleTabHeader<T = string>({
  data,
  activeIndex,
  onTabPress,
  renderTitle,
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
                size="$bodyLgMedium"
                color={isActive ? '$text' : '$textSubdued'}
              >
                {titleContent}
              </SizableText>
            );
          }
          return <Stack>{titleContent}</Stack>;
        }

        return (
          <SizableText
            size="$bodyLgMedium"
            color={isActive ? '$text' : '$textSubdued'}
          >
            {item.title}
          </SizableText>
        );
      };

      return (
        <ButtonFrame
          m="$0"
          key={item.id as string}
          onPress={() => handleTabPress(index, item.id)}
          borderBottomWidth="$0.5"
          borderBottomColor={isActive ? '$text' : 'transparent'}
          opacity={isActive ? 1 : 0.6}
          py="$1.5"
          hoverStyle={{
            bg: isActive ? '$bgActive' : '$bgHover',
          }}
          pressStyle={{
            bg: isActive ? '$bgActive' : '$bgPressed',
          }}
        >
          {renderContent()}
        </ButtonFrame>
      );
    },
    [activeIndex, renderTitle, handleTabPress],
  );

  return (
    <XStack
      gap="$5"
      px="$5"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
    >
      {data.map(renderTabButton)}
    </XStack>
  );
}
