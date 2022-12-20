import type { FC } from 'react';
import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Select, useIsVerticalLayout } from '@onekeyhq/components';
import type { WalletType } from '@onekeyhq/engine/src/types/wallet';

export type AccountType = WalletType;

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
    <Icon size={20} name="DotsHorizontalMini" />
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
                  name: isVerticalLayout ? 'TagOutline' : 'TagMini',
                },
              },
              {
                label: intl.formatMessage({ id: 'action__copy_address' }),
                value: 'copy',
                iconProps: {
                  name: isVerticalLayout
                    ? 'Square2StackOutline'
                    : 'Square2StackMini',
                },
              },
              {
                label: intl.formatMessage({ id: 'action__view_details' }),
                value: 'detail',
                iconProps: {
                  name: isVerticalLayout
                    ? 'DocumentTextOutline'
                    : 'DocumentTextMini',
                },
              },
              {
                label: intl.formatMessage({ id: 'action__remove_account' }),
                value: 'remove',
                iconProps: {
                  name: isVerticalLayout ? 'TrashOutline' : 'TrashMini',
                },
                destructive: true,
              },
            ]
          : [
              {
                label: intl.formatMessage({ id: 'action__rename' }),
                value: 'rename',
                iconProps: {
                  name: isVerticalLayout ? 'TagOutline' : 'TagMini',
                },
              },
              {
                label: intl.formatMessage({ id: 'action__copy_address' }),
                value: 'copy',
                iconProps: {
                  name: isVerticalLayout
                    ? 'Square2StackOutline'
                    : 'Square2StackMini',
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
      renderTrigger={({ isHovered, visible }) => (
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
