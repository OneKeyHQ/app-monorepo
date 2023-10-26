import { useState } from 'react';

import { Button, Dialog, Stack } from '@onekeyhq/components';
import { ActionList } from '@onekeyhq/components/src/ActionList';

import { Layout } from './utils/Layout';

const ActionListDemo1 = () => {
  const [open, onOpenChange] = useState(false);
  return (
    <ActionList
      open={open}
      onOpenChange={onOpenChange}
      title="Action List"
      renderTrigger={
        <Button onPress={() => onOpenChange(true)}>Action List</Button>
      }
      items={[
        {
          label: 'Action1',
          icon: 'PlaceholderOutline',
          onPress: () => {
            onOpenChange(false);
            console.log('action1');
          },
        },
        {
          label: 'Action2',
          icon: 'PlaceholderOutline',
          onPress: () => {
            onOpenChange(false);
            console.log('action2');
          },
        },
        {
          label: 'Action3',
          icon: 'PlaceholderOutline',
          onPress: () => {
            onOpenChange(false);
            console.log('action2');
          },
          disabled: true,
        },
      ]}
    />
  );
};

const ActionListDemo2 = () => {
  const [open, onOpenChange] = useState(false);
  return (
    <ActionList
      open={open}
      onOpenChange={onOpenChange}
      title="Action List"
      renderTrigger={
        <Button onPress={() => onOpenChange(true)}>Action List</Button>
      }
      sections={[
        {
          items: [
            {
              label: 'Action1',
              icon: 'PlaceholderOutline',
              onPress: () => {
                onOpenChange(false);
                console.log('action1');
              },
            },
            {
              label: 'Action2',
              icon: 'PlaceholderOutline',
              onPress: () => {
                onOpenChange(false);
                console.log('action2');
              },
            },
            {
              label: 'Action3',
              icon: 'PlaceholderOutline',
              onPress: () => {
                onOpenChange(false);
                console.log('action2');
              },
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
                onOpenChange(false);
                Dialog.confirm({
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
};

const ActionListDemo3 = () => {
  const [open, onOpenChange] = useState(false);
  return (
    <ActionList
      open={open}
      onOpenChange={onOpenChange}
      title="Action List"
      renderTrigger={
        <Button onPress={() => onOpenChange(true)}>With Section Title</Button>
      }
      sections={[
        {
          title: 'Title 1',
          items: [
            {
              label: 'Action1',
              icon: 'PlaceholderOutline',
              onPress: () => {
                onOpenChange(false);
                console.log('action1');
              },
            },
            {
              label: 'Action2',
              icon: 'PlaceholderOutline',
              onPress: () => {
                onOpenChange(false);
                console.log('action2');
              },
            },
            {
              label: 'Action3',
              icon: 'PlaceholderOutline',
              onPress: () => {
                onOpenChange(false);
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
                onOpenChange(false);
                Dialog.confirm({
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
};

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
        title: 'Sections',
        element: (
          <Stack space="$1">
            <ActionListDemo2 />
            <ActionListDemo3 />
          </Stack>
        ),
      },
    ]}
  />
);

export default ActionListGallery;
