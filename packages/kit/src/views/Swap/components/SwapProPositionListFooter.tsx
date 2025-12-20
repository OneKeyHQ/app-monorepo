import { useIntl } from 'react-intl';

import { Button, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ISwapProPositionListFooterProps {
  onSearchClick: () => void;
}

function SwapProPositionListFooter({
  onSearchClick,
}: ISwapProPositionListFooterProps) {
  const intl = useIntl();
  return (
    <XStack bg="$bgApp" p="$4" justifyContent="center" alignItems="center">
      <SizableText color="$textSubdued" size="$bodyMd">
        {intl.formatMessage({ id: ETranslations.dexmarket_pro_token_find })}
      </SizableText>
      <Button
        variant="tertiary"
        size="small"
        iconAfter="ArrowRightOutline"
        onPress={onSearchClick}
      >
        {intl.formatMessage({
          id: ETranslations.dexmarket_pro_token_find_search,
        })}
      </Button>
    </XStack>
  );
}

export default SwapProPositionListFooter;
