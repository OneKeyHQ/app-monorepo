import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, IconButton, Pressable, Text } from '@onekeyhq/components';
import WalletAvatar from '@onekeyhq/kit/src/components/Header/WalletAvatar';

type SectionHeaderProps = {
  walletName?: string;
  emptySectionData?: boolean;
};

const defaultProps = {} as const;

const SectionHeader: FC<SectionHeaderProps> = ({
  walletName,
  emptySectionData,
}) => {
  const intl = useIntl();

  const AddAccountAction: FC<{ fullBleed: boolean }> = ({ fullBleed }) => (
    <>
      {fullBleed ? (
        <Box p={2} pb={0}>
          <Pressable
            rounded="xl"
            flexDirection="row"
            alignItems="center"
            justifyContent="center"
            p={2}
            borderWidth={1}
            borderColor="border-default"
            borderStyle="dashed"
            _hover={{ bgColor: 'surface-hovered' }}
            _pressed={{ bgColor: 'surface-pressed' }}
          >
            <Icon name="PlusSmSolid" size={20} />
            <Text ml={2} typography="Body2Strong">
              {intl.formatMessage({ id: 'action__add_account' })}
            </Text>
          </Pressable>
        </Box>
      ) : (
        <IconButton type="plain" name="PlusCircleSolid" circle />
      )}
    </>
  );

  return (
    <Box>
      <Box flexDirection="row" alignItems="center" mb={2} pl={2} pr={1.5}>
        <Box flex={1} flexDirection="row" alignItems="center" mr={3}>
          <WalletAvatar size="xs" />
          <Text ml={2} typography="Subheading" color="text-subdued" isTruncated>
            {walletName}
          </Text>
        </Box>
        {!emptySectionData ? <AddAccountAction fullBleed={false} /> : undefined}
      </Box>
      {emptySectionData ? <AddAccountAction fullBleed /> : undefined}
    </Box>
  );
};

SectionHeader.defaultProps = defaultProps;

export default SectionHeader;
