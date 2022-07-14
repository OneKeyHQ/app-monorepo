import { Center, Icon } from '@onekeyhq/components';

const BackupIcon = ({ enabled }: { enabled: boolean }) => (
  <Center
    rounded="full"
    size="12"
    bgColor={`surface-${enabled ? 'success' : 'warning'}-subdued`}
  >
    <Icon
      name="CloudOutline"
      size={24}
      color={`icon-${enabled ? 'success' : 'warning'}`}
    />
  </Center>
);

export default BackupIcon;
