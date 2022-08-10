import { Center, Icon } from '@onekeyhq/components';

const BackupIcon = ({ enabled, size }: { enabled: boolean; size?: string }) => (
  <Center
    rounded="full"
    size={size === 'lg' ? '56px' : '48px'}
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
