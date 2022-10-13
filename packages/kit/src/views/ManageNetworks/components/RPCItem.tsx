import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  HStack,
  Icon,
  IconButton,
  Skeleton,
  Typography,
  VStack,
} from '@onekeyhq/components';

import Speedindicator from '../../../components/NetworkAccountSelector/NetworkAccountSelectorModal/SpeedIndicator';
import { MeasureResult } from '../hooks';

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
  const { responseTime, color, latestBlock } = measure || {};
  const responseTimeSection = useMemo(() => {
    if (!measure) {
      return <Skeleton shape="Caption" />;
    }
    return (
      <>
        <Speedindicator borderWidth={0} backgroundColor={color} />
        <Typography.Caption color={color} ml="2">
          {typeof responseTime === 'number'
            ? `${responseTime} ms`
            : intl.formatMessage({ id: 'content__not_available' })}
        </Typography.Caption>
      </>
    );
  }, [measure, color, intl, responseTime]);

  const blockHeightSection = useMemo(() => {
    if (!measure) {
      return <Skeleton shape="Caption" />;
    }
    if (typeof latestBlock !== 'number') {
      return null;
    }
    return (
      <Typography.Caption>
        {intl.formatMessage({ id: 'content__height' })}: {latestBlock}
      </Typography.Caption>
    );
  }, [measure, intl, latestBlock]);

  const actionIcon = useMemo(() => {
    if (checked) {
      return <Icon name="CheckSolid" size={20} color="interactive-default" />;
    }
    if (!isEdit || !canEdit) {
      return null;
    }
    return (
      <IconButton
        name="TrashSolid"
        type="plain"
        circle
        onPress={() => onRemove(url)}
      />
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
