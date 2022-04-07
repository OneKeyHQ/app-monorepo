import React from 'react';

import { Row } from 'native-base';

import { Icon, Text } from '@onekeyhq/components';

function TxTitleDetailView({
  title,
  detail,
  editable,
  isHovered,
}: {
  title: string;
  detail: string | any;
  editable?: boolean;
  isHovered?: boolean;
}) {
  return (
    <Row
      bgColor={isHovered && editable ? 'surface-hovered' : undefined}
      justifyContent="space-between"
      space="16px"
      padding="16px"
      borderRadius="12px"
    >
      <Text
        color="text-subdued"
        typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
      >
        {title}
      </Text>
      {typeof detail === 'string' ? (
        <Text
          textAlign="right"
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          flex={1}
          numberOfLines={1}
        >
          {detail}
        </Text>
      ) : (
        detail
      )}
      {editable && <Icon key="edit icon" size={20} name="ChevronRightSolid" />}
    </Row>
  );
}

export { TxTitleDetailView };
