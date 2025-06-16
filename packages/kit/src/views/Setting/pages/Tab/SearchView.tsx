import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Accordion,
  Empty,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TabSettingsListGrid, TabSettingsSection } from './ListItem';

import type { ISettingsSearchResult } from './useSearch';

export function SearchView({
  sections,
  isSearching,
}: {
  sections: ISettingsSearchResult[];
  isSearching: boolean;
}) {
  const intl = useIntl();
  if (!isSearching) {
    return null;
  }
  return sections.length ? (
    <YStack gap="$4" px="$5">
      {sections.map((section) => (
        <Accordion
          overflow="hidden"
          width="100%"
          type="multiple"
          key={section.title}
          defaultValue={[section.title]}
        >
          <Accordion.Item value={section.title}>
            <Accordion.Trigger
              unstyled
              flexDirection="row"
              alignItems="center"
              alignSelf="flex-start"
              px="$1"
              mx="$-1"
              width="100%"
              justifyContent="space-between"
              borderWidth={0}
              bg="$transparent"
              userSelect="none"
              borderRadius="$1"
            >
              {({ open }: { open: boolean }) => (
                <>
                  <XStack gap="$1.5" alignItems="center">
                    <Icon name={section.icon as IKeyOfIcons} size="$5" />
                    <SizableText size="$bodyMd">{section.title}</SizableText>
                  </XStack>
                  <XStack>
                    <YStack
                      animation="quick"
                      rotate={open ? '180deg' : '0deg'}
                      left="$2"
                    >
                      <Icon
                        name="ChevronDownSmallOutline"
                        color={open ? '$iconDisabled' : '$iconSubdued'}
                        size="$5"
                      />
                    </YStack>
                  </XStack>
                </>
              )}
            </Accordion.Trigger>
            <Accordion.HeightAnimator animation="quick">
              <Accordion.Content
                animation="quick"
                exitStyle={{ opacity: 0 }}
                px={0}
                pb={0}
                pt="$3.5"
                gap="$2.5"
              >
                <TabSettingsSection>
                  {section.configs.map((config) => (
                    <TabSettingsListGrid
                      key={config.item.title}
                      item={config.item}
                      titleMatch={config.matches?.[0]}
                    />
                  ))}
                </TabSettingsSection>
              </Accordion.Content>
            </Accordion.HeightAnimator>
          </Accordion.Item>
        </Accordion>
      ))}
    </YStack>
  ) : (
    <YStack flex={1} ai="center" jc="center">
      <Empty
        icon="SearchOutline"
        title={intl.formatMessage({
          id: ETranslations.global_no_results,
        })}
      />
    </YStack>
  );
}
