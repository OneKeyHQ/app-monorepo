import {
  ActionList,
  Button,
  Dialog,
  Stack,
  YStack,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ActionListDemo1 = () => (
  <ActionList
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
        disabled: true,
      },
    ]}
  />
);

const ActionListPlacement = () => (
  <YStack space="$2">
    <ActionList
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
    description="对操作结果的反馈，无需用户操作即可自行消失"
    suggestions={[
      '使用 Toast 显示简约明确的信息反馈',
      '用户点击或触摸 Toast 内容时，浮层将会停留在页面上',
      'Toast 显示的文本应少于 20 字',
      '不建议使用 Toast 显示过长的报错信息',
    ]}
    boundaryConditions={[
      'Toast 永远拥有最高层级的浮层',
      'Toast 组件能显示的最长文本内容为三排，超出三排将会缩略',
      '界面中只会存在一个 Toast 示例，后触发的 Toast 信息会覆盖前一条 Toast 信息',
    ]}
    elements={[
      {
        title: 'Simple',
        element: (
          <Stack space="$1">
            <ActionListDemo1 />
          </Stack>
        ),
      },
      {
        title: 'Placement',
        element: (
          <Stack space="$1">
            <ActionListPlacement />
          </Stack>
        ),
      },
      {
        title: 'Sections',
        element: (
          <Stack space="$1">
            <ActionListDemo2 />
            <ActionListDemo3 />
          </Stack>
        ),
      },
      {
        title: 'Long Press',
        element: (
          <Stack space="$1">
            <Button
              onLongPress={() => {
                ActionList.show({
                  title: 'Action List',
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
