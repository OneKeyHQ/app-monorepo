/* eslint-disable react/no-unstable-nested-components */
import { useState } from 'react';

import {
  Center,
  CheckBox,
  Divider,
  Menu,
  Pressable,
  Text,
} from '@onekeyhq/components';

import BaseMenu from '../../Overlay/BaseMenu';

const MenuGallery = () => {
  const [isChecked, setIsChecked] = useState(false);
  return (
    <Center flex="1" bg="background-hovered">
      <Menu
        w="190"
        trigger={(triggerProps) => (
          <Pressable accessibilityLabel="More options menu" {...triggerProps}>
            <Text>Basic</Text>
          </Pressable>
        )}
      >
        <Menu.Item>Arial</Menu.Item>
        <Menu.Item>Nunito Sans</Menu.Item>
        <Menu.Item isDisabled>Sofia</Menu.Item>
        <Menu.Item variant="destructive">Delete</Menu.Item>
        <Menu.Item variant="highlight">Update</Menu.Item>
      </Menu>

      <Menu
        w="190"
        trigger={(triggerProps) => (
          <Pressable accessibilityLabel="More options menu" {...triggerProps}>
            <Text>Menu with icons</Text>
          </Pressable>
        )}
      >
        <Menu.CustomItem icon="PencilMini">Edit</Menu.CustomItem>
        <Menu.CustomItem variant="desctructive" icon="TrashMini">
          Delete
        </Menu.CustomItem>
        <Menu.CustomItem variant="highlight" icon="ArrowNarrowUpMini">
          Update
        </Menu.CustomItem>
        <Menu.CustomItem isDisabled icon="ArrowNarrowUpMini">
          Update
        </Menu.CustomItem>
      </Menu>

      <BaseMenu
        options={[
          {
            type: 'group',
            title: 'title__help',
            children: [{ id: 'content__enter_pin_in_app' }, { id: 'Rate' }],
          },
          () => <Divider my="4px" />,
          {
            type: 'group',
            title: 'title__help',
            children: [{ id: 'Verify_Password' }, { id: 'action__buy' }],
          },
        ]}
      >
        <Pressable>
          <Text>Grouping</Text>
        </Pressable>
      </BaseMenu>

      <BaseMenu
        closeOnSelect={false}
        options={[
          {
            type: 'radio',
            title: 'title__help',
            defaultValue: 1,
            children: [
              {
                id: 'Handling_Fee',
                value: 1,
              },

              {
                id: 'Estimated_Gas',
                value: 2,
              },
            ],
          },
          () => <Divider my="4px" />,
          {
            type: 'checkbox',
            title: 'title__help',
            children: [
              { id: 'content__enter_pin_in_app', value: 1 },
              { id: 'Confirm_password', value: 2 },
            ],
          },
        ]}
      >
        <Pressable>
          <Text>MenuOptionGroups</Text>
        </Pressable>
      </BaseMenu>

      <BaseMenu
        options={[
          {
            id: 'content__enter_pin_in_app',
            onPress: () => setIsChecked(!isChecked),
            extraChildren: (
              <CheckBox isChecked={isChecked} onChange={setIsChecked} />
            ),
            closeOnSelect: false,
          },
        ]}
      >
        <Pressable accessibilityLabel="More options menu">
          <Text>Menu with checkBox</Text>
        </Pressable>
      </BaseMenu>
    </Center>
  );
};

export default MenuGallery;
