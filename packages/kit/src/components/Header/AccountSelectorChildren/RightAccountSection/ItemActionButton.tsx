import React, { FC, memo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Select, useIsVerticalLayout } from '@onekeyhq/components';

export type AccountType = 'hd' | 'hw' | 'imported' | 'watching';

type CustomSelectTriggerProps = {
  isSelectVisible?: boolean;
  isTriggerHovered?: boolean;
  isTriggerPressed?: boolean;
};

const CustomSelectTrigger: FC<CustomSelectTriggerProps> = ({
  isSelectVisible,
  isTriggerHovered,
  isTriggerPressed,
}) => (
  <Box
    p={2}
    borderRadius="xl"
    bg={
      // eslint-disable-next-line no-nested-ternary
      isSelectVisible
        ? 'surface-selected'
        : // eslint-disable-next-line no-nested-ternary
        isTriggerPressed
        ? 'surface-pressed'
        : isTriggerHovered
        ? 'surface-hovered'
        : 'transparent'
    }
  >
    <Icon size={20} name="DotsHorizontalSolid" />
  </Box>
);

const CustomSelectTriggerMemo = memo(CustomSelectTrigger);

type Props = {
  type: AccountType | undefined;
  onChange: (v: string) => void;
};

const ItemActionButton: FC<Props> = ({ onChange, type }) => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  return (
    <Select
      dropdownPosition="right"
      onChange={(v) => onChange(v)}
      activatable={false}
      options={
        type !== 'hw'
          ? [
              {
                label: intl.formatMessage({ id: 'action__rename' }),
                value: 'rename',
                iconProps: {
                  name: isVerticalLayout ? 'TagOutline' : 'TagSolid',
                },
              },
              {
                label: intl.formatMessage({ id: 'action__view_details' }),
                value: 'detail',
                iconProps: {
                  name: isVerticalLayout
                    ? 'DocumentTextOutline'
                    : 'DocumentTextSolid',
                },
              },
              {
                label: intl.formatMessage({ id: 'action__remove_account' }),
                value: 'remove',
                iconProps: {
                  name: isVerticalLayout ? 'TrashOutline' : 'TrashSolid',
                },
                destructive: true,
              },
            ]
          : [
              {
                label: intl.formatMessage({ id: 'action__rename' }),
                value: 'rename',
                iconProps: {
                  name: isVerticalLayout ? 'TagOutline' : 'TagSolid',
                },
              },
            ]
      }
      headerShown={false}
      footer={null}
      containerProps={{ width: 'auto' }}
      dropdownProps={{
        width: 248,
      }}
      renderTrigger={(activeOption, isHovered, visible) => (
        <CustomSelectTriggerMemo
          isTriggerHovered={isHovered}
          isSelectVisible={visible}
          isTriggerPressed={visible}
        />
      )}
    />
  );
};

export default memo(ItemActionButton);
