import {
  ActionList,
  Button,
  Dialog,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';

import { Layout } from './utils/Layout';

const ActionListDemo1 = () => (
  <ActionList
    trackID="action-list-demo-1"
    title="Action List"
    renderTrigger={
      <Button onPress={() => console.log('action trigger')}>Action List</Button>
    }
    items={[
      {
        label: 'Action1',
        icon: 'PlaceholderOutline',
        onPress: () => {
          console.log('action1');
        },
      },
      {
        label: 'Action2',
        icon: 'PlaceholderOutline',
        onPress: (close) => {
          setTimeout(() => {
            console.log('action2');
            close();
          }, 3500);
        },
      },
      {
        label: 'Action3',
        icon: 'PlaceholderOutline',
        onPress: () => {
          console.log('action3');
        },
        disabled: true,
      },
    ]}
  />
);

const ActionListPlacement = () => (
  <YStack gap="$2">
    <ActionList
      trackID="action-list-placement-top"
      title="right(Web Only)"
      placement="top"
      renderTrigger={
        <Button onPress={() => console.log('action trigger')}>
          right(Web Only)
        </Button>
      }
      items={[
        {
          label: 'Action1',
          icon: 'PlaceholderOutline',
          onPress: () => {
            console.log('action1');
          },
        },
      ]}
    />
    <ActionList
      trackID="action-list-placement-bottom-end"
      title="bottom-end(Web Only)"
      placement="bottom-end"
      renderTrigger={
        <Button onPress={() => console.log('action trigger')}>
          bottom-end(Web Only)
        </Button>
      }
      items={[
        {
          label: 'Action1',
          icon: 'PlaceholderOutline',
          onPress: () => {
            console.log('action1');
          },
        },
      ]}
    />
  </YStack>
);

const ActionListDemo2 = () => (
  <ActionList
    trackID="action-list-demo-2"
    title="Action List(Close demo)"
    renderTrigger={
      <Button onPress={() => console.log('trigger')}>Action List</Button>
    }
    sections={[
      {
        items: [
          {
            label: 'just close it',
            icon: 'PlaceholderOutline',
            onPress: () => {
              console.log('action1');
            },
          },
          {
            label: 'async action(fail)',
            icon: 'PlaceholderOutline',
            onPress: () =>
              new Promise((resolve) => {
                setTimeout(() => {
                  alert('fail');
                  resolve(false);
                }, 1000);
              }),
          },
          {
            label: 'async action(success)',
            icon: 'PlaceholderOutline',
            onPress: () =>
              new Promise((resolve) => {
                setTimeout(() => {
                  alert('success');
                  resolve(true);
                }, 1000);
              }),
          },
        ],
      },
      {
        items: [
          {
            label: 'Action4',
            icon: 'PlaceholderOutline',
            destructive: true,
            onPress: () => {
              Dialog.show({
                title: 'Lorem ipsum',
                description:
                  'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                onConfirm: () => {
                  alert('confirmed');
                },
              });
            },
          },
        ],
      },
    ]}
  />
);

const ActionListDemo3 = () => (
  <ActionList
    trackID="action-list-demo-3"
    title="Action List"
    renderTrigger={<Button>With Section Title</Button>}
    sections={[
      {
        title: 'Title 1',
        items: [
          {
            label: 'Action1',
            icon: 'PlaceholderOutline',
            onPress: () => {
              console.log('action1');
            },
          },
          {
            label: 'Action2',
            icon: 'PlaceholderOutline',
            shortcutKeys: [shortcutsKeys.CmdOrCtrl, 'k'],
            onPress: () => {
              console.log('action2');
            },
          },
          {
            label: 'Action3',
            icon: 'PlaceholderOutline',
            onPress: () => {
              console.log('action2');
            },
          },
        ],
      },
      {
        title: 'Title 2',
        items: [
          {
            label: 'Action4',
            icon: 'PlaceholderOutline',
            destructive: true,
            onPress: () => {
              Dialog.show({
                title: 'Lorem ipsum',
                description:
                  'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                onConfirm: () => {
                  alert('confirmed');
                },
              });
            },
          },
        ],
      },
    ]}
  />
);

const ActionListGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="ActionList"
    elements={[
      {
        title: 'Simple',
        element: (
          <Stack gap="$1">
            <ActionListDemo1 />
          </Stack>
        ),
      },
      {
        title: 'Placement',
        element: (
          <Stack gap="$1">
            <ActionListPlacement />
          </Stack>
        ),
      },
      {
        title: 'Sections',
        element: (
          <Stack gap="$1">
            <ActionListDemo2 />
            <ActionListDemo3 />
          </Stack>
        ),
      },
      {
        title: 'shortcuts',
        element: (
          <ActionList
            trackID="action-list-shortcuts"
            title="Action List(Close demo)"
            renderTrigger={
              <Button onPress={() => console.log('trigger')}>
                Action List
              </Button>
            }
            sections={[
              {
                items: [
                  {
                    label: 'just close it',
                    icon: 'PlaceholderOutline',
                    shortcutKeys: [
                      shortcutsKeys.CmdOrCtrl,
                      shortcutsKeys.Alt,
                      'k',
                    ],
                    onPress: () => {
                      console.log('action1');
                    },
                  },
                  {
                    label: 'async action(fail)',
                    icon: 'PlaceholderOutline',
                    shortcutKeys: [shortcutsKeys.CmdOrCtrl, 'o'],
                    onPress: () =>
                      new Promise((resolve) => {
                        setTimeout(() => {
                          alert('fail');
                          resolve(false);
                        }, 1000);
                      }),
                  },
                ],
              },
            ]}
          />
        ),
      },
      {
        title: 'Long Press (function call)',
        element: (
          <Stack gap="$1">
            <Button
              onLongPress={() => {
                ActionList.show({
                  title: 'Action List (function call)',
                  sections: [
                    {
                      items: [
                        {
                          label: 'just close it',
                          icon: 'PlaceholderOutline',
                          onPress: () => {
                            console.log('action1');
                          },
                        },
                        {
                          label: 'async action(fail)',
                          icon: 'PlaceholderOutline',
                          onPress: () =>
                            new Promise((resolve) => {
                              setTimeout(() => {
                                alert('fail');
                                resolve(false);
                              }, 1000);
                            }),
                        },
                        {
                          label: 'async action(success)',
                          icon: 'PlaceholderOutline',
                          onPress: () =>
                            new Promise((resolve) => {
                              setTimeout(() => {
                                alert('success');
                                resolve(true);
                              }, 1000);
                            }),
                        },
                      ],
                    },
                    {
                      items: [
                        {
                          label: 'Action4',
                          icon: 'PlaceholderOutline',
                          destructive: true,
                          onPress: () => {
                            Dialog.show({
                              title: 'Lorem ipsum',
                              description:
                                'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                              onConfirm: () => {
                                alert('confirmed');
                              },
                            });
                          },
                        },
                      ],
                    },
                  ],
                });
              }}
            >
              Long Press
            </Button>
          </Stack>
        ),
      },
    ]}
  />
);

export default ActionListGallery;
