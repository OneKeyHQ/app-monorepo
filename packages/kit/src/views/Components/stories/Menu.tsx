import React from 'react';

import { Pressable as NBPressable } from 'native-base';

import { Center, Divider, Menu, Text } from '@onekeyhq/components';

const MenuGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Menu
      w="190"
      trigger={(triggerProps) => (
        <NBPressable accessibilityLabel="More options menu" {...triggerProps}>
          <Text>Basic</Text>
        </NBPressable>
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
        <NBPressable accessibilityLabel="More options menu" {...triggerProps}>
          <Text>Menu with icons</Text>
        </NBPressable>
      )}
    >
      <Menu.CustomItem icon="PencilSolid">Edit</Menu.CustomItem>
      <Menu.CustomItem variant="desctructive" icon="TrashSolid">
        Delete
      </Menu.CustomItem>
      <Menu.CustomItem variant="highlight" icon="ArrowNarrowUpSolid">
        Update
      </Menu.CustomItem>
      <Menu.CustomItem isDisabled icon="ArrowNarrowUpSolid">
        Update
      </Menu.CustomItem>
    </Menu>

    <Menu
      w="190"
      trigger={(triggerProps) => (
        <NBPressable {...triggerProps}>
          <Text>Grouping</Text>
        </NBPressable>
      )}
    >
      <Menu.Group title="Free">
        <Menu.Item>Arial</Menu.Item>
        <Menu.Item>Nunito Sans</Menu.Item>
      </Menu.Group>
      <Divider my="4px" />
      {/* <Divider mt="3" w="100%" /> */}
      <Menu.Group title="Paid">
        <Menu.Item>SF Pro</Menu.Item>
        <Menu.Item>Helvetica</Menu.Item>
      </Menu.Group>
    </Menu>

    <Menu
      closeOnSelect={false}
      w="190"
      onOpen={() => console.log('opened')}
      onClose={() => console.log('closed')}
      trigger={(triggerProps) => (
        <NBPressable {...triggerProps}>
          <Text>MenuOptionGroups</Text>
        </NBPressable>
      )}
    >
      <Menu.OptionGroup defaultValue="Arial" title="free" type="radio">
        <Menu.ItemOption value="Arial">Arial</Menu.ItemOption>
        <Menu.ItemOption value="Nunito Sans">Nunito Sans</Menu.ItemOption>
        <Menu.ItemOption value="Roboto">Roboto</Menu.ItemOption>
      </Menu.OptionGroup>
      <Divider my="4px" />
      {/* <Divider mt="3" w="100%" /> */}
      <Menu.OptionGroup title="paid" type="checkbox">
        <Menu.ItemOption value="SF Pro">SF Pro</Menu.ItemOption>
        <Menu.ItemOption value="Helvetica">Helvetica</Menu.ItemOption>
      </Menu.OptionGroup>
    </Menu>
  </Center>
);

export default MenuGallery;
