import { Row } from 'native-base';

import { Icon, Text } from '@onekeyhq/components';

function TxTitleDetailView({
  title,
  detail,
  arrow,
  isHovered,
}: {
  title: string;
  detail: string | any;
  arrow?: boolean;
  isHovered?: boolean;
}) {
  return (
    <Row
      bgColor={isHovered && arrow ? 'surface-hovered' : undefined}
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
          numberOfLines={3}
        >
          {detail}
        </Text>
      ) : (
        detail
      )}
      {arrow && (
        <Icon
          key="edit icon"
          size={20}
          name="ChevronRightMini"
          color="icon-subdued"
        />
      )}
    </Row>
  );
}

export { TxTitleDetailView };
