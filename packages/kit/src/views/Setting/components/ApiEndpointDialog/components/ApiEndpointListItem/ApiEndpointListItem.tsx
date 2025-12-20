import { IconButton, Stack, Switch } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import { serviceModuleLabels } from '../../constants';

import type { IApiEndpointConfig } from '../../types';

interface IApiEndpointListItemProps {
  config: IApiEndpointConfig;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onEdit: (config: IApiEndpointConfig) => void;
  onDelete: (id: string, name: string) => void;
}

export function ApiEndpointListItem({
  config,
  onToggleEnabled,
  onEdit,
  onDelete,
}: IApiEndpointListItemProps) {
  return (
    <ListItem
      px="$1"
      title={config.name}
      subtitle={`${serviceModuleLabels[config.serviceModule]}: ${config.api}`}
    >
      <Stack flexDirection="row" alignItems="center" gap="$3">
        <Switch
          size="small"
          value={config.enabled}
          onChange={(enabled) => onToggleEnabled(config.id, enabled)}
        />
        <IconButton
          icon="PencilOutline"
          variant="tertiary"
          size="small"
          onPress={() => onEdit(config)}
        />
        <IconButton
          icon="DeleteOutline"
          variant="tertiary"
          size="small"
          onPress={() => onDelete(config.id, config.name)}
        />
      </Stack>
    </ListItem>
  );
}
