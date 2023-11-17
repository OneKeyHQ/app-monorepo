import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/components';

import { Section } from './Section';

export const DataSection = () => {
  const onPress = useCallback(() => {}, []);
  const intl = useIntl();
  return (
    <Section title="DATA">
      <ListItem
        onPress={onPress}
        icon="BroomOutline"
        title="Clear cache on App"
      />
      <ListItem
        onPress={onPress}
        icon="CompassOutline"
        title="Clear cache of web browser"
      />
      <ListItem
        onPress={onPress}
        icon="Document2Outline"
        title={intl.formatMessage({ id: 'content__state_logs' })}
      >
        <ListItem.IconButton
          disabled
          icon="DownloadOutline"
          iconProps={{
            color: '$iconActive',
          }}
        />
      </ListItem>
      <ListItem
        iconProps={{ color: '$textCritical' }}
        onPress={onPress}
        icon="DeleteOutline"
        title={intl.formatMessage({ id: 'action__erase_data' })}
        titleProps={{ color: '$textCritical' }}
      />
    </Section>
  );
};
