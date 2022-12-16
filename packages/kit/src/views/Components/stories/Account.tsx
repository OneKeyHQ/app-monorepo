import { Account, Center, VStack } from '@onekeyhq/components';

const AccountGallery = () => (
  <Center flex="1" bg="background-hovered">
    <VStack space={4}>
      <Account
        avatarSize="sm"
        name="账户一"
        address="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48"
      />
      <Account
        hiddenAvatar
        address="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48"
      />
      <Account
        avatarSize="lg"
        amount="0.01"
        address="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48"
      />
      <Account
        avatarSize="xl"
        name="账户一"
        amount="123123"
        address="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48"
      />
      <Account
        notShowAddress
        avatarSize="xl"
        name="账户一"
        amount="123123"
        address="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48"
      />
      <Account
        hiddenAvatar
        avatarSize="xl"
        name="账户一"
        amount="123123"
        address="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48"
      />
      <Account
        hiddenAvatar
        avatarSize="sm"
        name="账户一"
        address="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48"
      />
      <Account address="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48" />
      <Account
        hiddenAvatar
        avatarSize="lg"
        amount="0.01"
        address="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48"
      />
      <Account
        hiddenAvatar
        avatarSize="xl"
        name="账户一"
        amount="123123"
        address="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48"
      />
      <Account
        hiddenAvatar
        notShowAddress
        avatarSize="xl"
        name="账户一"
        amount="123123"
        address="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48"
      />
    </VStack>
  </Center>
);

export default AccountGallery;
