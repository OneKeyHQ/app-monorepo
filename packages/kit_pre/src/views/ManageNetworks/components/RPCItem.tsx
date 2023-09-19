import { useMemo } from 'react';

import { AnimatePresence, MotiView } from 'moti';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  HStack,
  Icon,
  IconButton,
  Skeleton,
  Typography,
  VStack,
} from '@onekeyhq/components';

import Speedindicator from '../../../components/NetworkAccountSelector/modals/NetworkAccountSelectorModal/SpeedIndicator';

import type { MeasureResult } from '../hooks';

export const RPCItem = ({
  url,
  measure,
  checked,
  isEdit,
  canEdit,
  onRemove,
}: {
  url: string;
  measure: MeasureResult;
  checked: boolean;
  isEdit: boolean;
  canEdit: boolean;
  onRemove: (url: string) => void;
}) => {
  const intl = useIntl();
  const { responseTime, iconColor, latestBlock } = measure || {};
  const responseTimeSection = useMemo(() => {
    if (!measure) {
      return <Skeleton shape="Caption" />;
    }
    return (
      <>
        <Speedindicator borderWidth={0} backgroundColor={iconColor} />
        <Typography.Caption color={iconColor} ml="2">
          {typeof responseTime === 'number'
            ? `${responseTime} ms`
            : intl.formatMessage({ id: 'content__not_available' })}
        </Typography.Caption>
      </>
    );
  }, [measure, iconColor, intl, responseTime]);

  const blockHeightSection = useMemo(() => {
    if (!measure) {
      return <Skeleton shape="Caption" />;
    }
    if (typeof latestBlock !== 'number' || !latestBlock) {
      return null;
    }
    return (
      <Typography.Caption color="text-subdued">
        {intl.formatMessage({ id: 'content__height' })}: {latestBlock}
      </Typography.Caption>
    );
  }, [measure, intl, latestBlock]);

  const actionIcon = useMemo(() => {
    if (checked) {
      return (
        <Box p="8px">
          <Icon name="CheckMini" size={20} color="interactive-default" />
        </Box>
      );
    }
    if (!isEdit || !canEdit) {
      return null;
    }
    return (
      <AnimatePresence>
        <MotiView
          from={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{ type: 'timing', duration: 150 }}
        >
          <IconButton
            name="TrashMini"
            type="plain"
            circle
            onPress={() => onRemove(url)}
          />
        </MotiView>
      </AnimatePresence>
    );
  }, [checked, isEdit, canEdit, onRemove, url]);

  return (
    <HStack w="full" alignItems="center">
      <VStack flex="1">
        <Typography.Body2Strong numberOfLines={1} flex="1" isTruncated>
          {url}
        </Typography.Body2Strong>
        <HStack mt="6px">
          <HStack alignItems="center">
            {responseTimeSection}
            {!!blockHeightSection && (
              <Divider
                key="rightDivider"
                bg="border-subdued"
                orientation="vertical"
                h="3"
                mx={2}
              />
            )}
            {blockHeightSection}
          </HStack>
        </HStack>
      </VStack>
      {actionIcon}
    </HStack>
  );
};
