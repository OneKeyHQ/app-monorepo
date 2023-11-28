import { useIntl } from 'react-intl';

import { Icon, ListItem } from '@onekeyhq/components';
import type { ITool } from '@onekeyhq/shared/types';

type IProps = {
  tool: ITool;
  onPress?: (tool: ITool) => void;
};

function ToolListItem(props: IProps) {
  const { tool, onPress } = props;
  const intl = useIntl();
  return (
    <ListItem
      width="50%"
      key={tool.title}
      title={intl.formatMessage({ id: tool.title })}
      subtitle={intl.formatMessage({ id: tool.description })}
      subtitleProps={{
        numberOfLines: 1,
      }}
      avatarProps={{
        src: tool.logoURI,
        fallbackProps: {
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon name="ImageMountainSolid" />,
        },
      }}
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$4"
      padding="$4"
      mb="$4"
      onPress={() => onPress?.(tool)}
    />
  );
}

export { ToolListItem };
