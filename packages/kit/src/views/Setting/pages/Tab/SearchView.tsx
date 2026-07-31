import { Fragment, useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Accordion,
  Empty,
  Icon,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  MobileTabSettingsDivider,
  MobileTabSettingsSection,
  TabSettingsListGrid,
  TabSettingsSection,
} from './ListItem';
import { useIsTabNavigator } from './useIsTabNavigator';

import type { ISettingsSearchResult } from './useSearch';

export function SearchView({
  sections,
  isSearching,
}: {
  sections: ISettingsSearchResult[];
  isSearching: boolean;
}) {
  const intl = useIntl();
  const isTabNavigator = useIsTabNavigator();
  const isMobileLayout = platformEnv.isNative && !isTabNavigator;
  if (!isSearching) {
    return null;
  }
  if (!sections.length) {
    return (
      <YStack flex={1} ai="center" jc="center">
        <Empty
          illustration="SearchDocument"
          title={intl.formatMessage({
            id: ETranslations.global_no_results,
          })}
        />
      </YStack>
    );
  }
  if (isMobileLayout) {
    return (
      <YStack gap="$5" px="$5" pt="$2">
        {sections.map((section) => (
          <YStack key={section.title} gap="$2">
            <XStack gap="$1.5" alignItems="center" px="$5">
              <Icon
                name={section.icon as IKeyOfIcons}
                size="$5"
                color="$iconSubdued"
              />
              <SizableText size="$bodyMdMedium" color="$textSubdued">
                {section.title}
              </SizableText>
            </XStack>
            <MobileTabSettingsSection>
              {section.configs.map((config, index) => (
                <Fragment key={`${config.item.title}-${index}`}>
                  <TabSettingsListGrid
                    item={config.item}
                    useMobilePresentation
                    titleMatch={config.matches?.find(
                      (match) => match.key === 'title',
                    )}
                  />
                  {index !== section.configs.length - 1 ? (
                    <MobileTabSettingsDivider />
                  ) : null}
                </Fragment>
              ))}
            </MobileTabSettingsSection>
          </YStack>
        ))}
      </YStack>
    );
  }
  return (
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
              px="$3"
              pt="$2"
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
                    <SizableText size="$bodyMdMedium">
                      {section.title}
                    </SizableText>
                  </XStack>
                  <XStack>
                    <YStack
                      animation="quick"
                      animateOnly={ANIMATE_ONLY_TRANSFORM}
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
                animateOnly={ANIMATE_ONLY_OPACITY}
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
                      titleMatch={config.matches?.find(
                        (m) => m.key === 'title',
                      )}
                    />
                  ))}
                </TabSettingsSection>
              </Accordion.Content>
            </Accordion.HeightAnimator>
          </Accordion.Item>
        </Accordion>
      ))}
    </YStack>
  );
}

export function SearchViewPage() {
  const intl = useIntl();
  const [searchText, setSearchText] = useState('');
  const [searchResult, setSearchResult] = useState<ISettingsSearchResult[]>([]);

  useEffect(() => {
    const callback = (
      payload: IAppEventBusPayload[EAppEventBusNames.SettingsSearchResult],
    ) => {
      // The bus keeps search items opaque so shared stays decoupled from kit;
      // this pane is the emitting feature's own consumer, so narrowing is safe.
      setSearchResult((payload.list ?? []) as ISettingsSearchResult[]);
      setSearchText(payload.searchText);
    };
    appEventBus.on(EAppEventBusNames.SettingsSearchResult, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.SettingsSearchResult, callback);
    };
  }, []);
  const isSearching = searchText.length > 0;
  const renderHeaderTitle = useCallback(() => {
    return (
      <SizableText color="$textSubdued" size="$headingLg">
        {intl.formatMessage(
          {
            id: ETranslations.settings_search_title,
          },
          {
            keyword: (
              <SizableText color="$text" size="$headingLg">
                {searchText}
              </SizableText>
            ),
          },
        )}
      </SizableText>
    );
  }, [intl, searchText]);
  return (
    <Page>
      <Page.Header headerTitle={renderHeaderTitle} />
      <Page.Body>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ pb: '$10' }}
        >
          <SearchView isSearching={isSearching} sections={searchResult} />
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
