import { useIntl } from 'react-intl';

import {
  IconButton,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DeviceManagementTestIDs } from '../../testIDs';

// Desktop page title, with adding a device beside it once there are cards.
// Phones show both in the navigation bar instead, and the last card in the
// grid adds one too.
function SectionHeader({ onAdd }: { onAdd?: () => void }) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  if (!gtMd) {
    return null;
  }
  const title = (
    <SizableText size="$heading2xl" color="$text" role="heading" aria-level={1}>
      {intl.formatMessage({
        id: ETranslations.device_management_devices__title,
      })}
    </SizableText>
  );
  if (!onAdd) {
    return title;
  }
  const addDeviceLabel = intl.formatMessage({
    id: ETranslations.device_management_add_device__action,
  });
  return (
    <XStack ai="center" jc="space-between" gap="$5">
      {title}
      <IconButton
        icon="PlusLargeOutline"
        size="small"
        variant="secondary"
        title={addDeviceLabel}
        accessibilityLabel={addDeviceLabel}
        hotKey
        onPress={onAdd}
        testID={DeviceManagementTestIDs.addDeviceHeaderBtn}
      />
    </XStack>
  );
}

export default SectionHeader;
