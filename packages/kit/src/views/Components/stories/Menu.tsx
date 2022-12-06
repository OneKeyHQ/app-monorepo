import { Center, Divider, Menu, Pressable, Text } from '@onekeyhq/components';

const MenuGallery = () => (
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

    <Menu
      w="190"
      trigger={(triggerProps) => (
        <Pressable {...triggerProps}>
          <Text>Grouping</Text>
        </Pressable>
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
        <Pressable {...triggerProps}>
          <Text>MenuOptionGroups</Text>
        </Pressable>
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
