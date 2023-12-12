import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { TextInput } from 'react-native';

import {
  ActionList,
  Dialog,
  IconButton,
  Input,
  ListItem,
  ListView,
  Page,
  Skeleton,
  Stack,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import simpleDb from '@onekeyhq/kit-bg/src/dbs/simple/simpleDb';

import {
  EDiscoveryModalRoutes,
  type IDiscoveryModalParamList,
} from '../../router/Routes';

import type { IBrowserBookmark } from '../../types';

function BookmarkListModal() {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();

  const { isLoading, result } = usePromiseResult(
    async () => {
      const data = await simpleDb.browserBookmarks.getRawData();
      return (data?.data as IBrowserBookmark[]) || [];
    },
    [],
    {
      watchLoading: true,
    },
  );

  const dataSource = useMemo(() => result ?? [], [result]);
  const [editTitle, setEditTitle] = useState<string>('');

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: 'actionn__bookmark' })}
        headerSearchBarOptions={{
          autoFocus: true,
          placeholder: 'Search',
          inputType: 'text',
          hideNavigationBar: true,
          hideWhenScrolling: false,
          onChangeText: ({ nativeEvent }) => {
            console.log(nativeEvent.text);
          },
        }}
      />
      <Page.Body>
        <Input value={editTitle} onChangeText={setEditTitle} />
        <Stack flex={1}>
          <ListView
            height="100%"
            estimatedItemSize="$10"
            data={dataSource}
            keyExtractor={(item) => item.url}
            renderItem={({ item }) => (
              <ListItem
                avatarProps={{
                  src: `${new URL(item.url ?? '').origin}/favicon.ico`,
                  fallbackProps: {
                    children: <Skeleton w="$10" h="$10" />,
                  },
                }}
                title={item.title}
                subtitle={item.url}
                subtitleProps={{
                  numberOfLines: 1,
                }}
                testID={`search-modal-${item.url.toLowerCase()}`}
                onPress={() => {
                  console.log('===>onPress');
                }}
              >
                <ActionList
                  title="Action List"
                  placement="right-start"
                  renderTrigger={
                    <IconButton
                      size="small"
                      icon="DotHorOutline"
                      variant="tertiary"
                      focusStyle={undefined}
                      p="$0.5"
                      m={-3}
                      testID="browser-bar-options"
                    />
                  }
                  items={[
                    {
                      label: 'Rename',
                      icon: 'StarSolid',
                      onPress: () => {
                        setEditTitle('ABC');
                        console.log('Rename');
                        Dialog.show({
                          title: item.title,
                          description: item.title,
                          renderContent: (
                            <Input
                              value={editTitle}
                              onChangeText={setEditTitle}
                            />
                          ),
                          onConfirm: () => {},
                        });
                      },
                      testID: `action-list-item-rename`,
                    },
                    {
                      label: 'Remove Bookmark',
                      icon: 'ThumbtackSolid',
                      onPress: () => {
                        console.log('Remove');
                      },
                      testID: `action-list-item-rename`,
                    },
                  ]}
                />
              </ListItem>
            )}
          />
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default BookmarkListModal;
