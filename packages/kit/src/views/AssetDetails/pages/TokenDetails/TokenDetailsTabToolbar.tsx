import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  Popover,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

type IProps = {
  tokens: IAccountToken[];
  onSelected: (token: IAccountToken) => void;
};

function TokenDetailsTabToolbar(props: IProps) {
  const { gtMd } = useMedia();
  const { tokens, onSelected } = props;
  const intl = useIntl();
  const renderContent = useCallback(
    ({ closePopover }: { closePopover: () => void }) => {
      return (
        <Stack gap="$2">
          {tokens.map((token) => (
            <Button
              key={token.$key}
              onPress={() => {
                onSelected(token);
                closePopover();
              }}
              mb="$2"
            >
              {token.networkName}
            </Button>
          ))}
        </Stack>
      );
    },
    [tokens, onSelected],
  );

  if (tokens.length <= 1) {
    return null;
  }

  const shouldShowToolbar = gtMd ? tokens.length > 5 : tokens.length > 3;

  if (!shouldShowToolbar) {
    return null;
  }

  return (
    <XStack pr="$5">
      <Popover
        title={intl.formatMessage({
          id: ETranslations.global_select_network,
        })}
        renderTrigger={
          <IconButton
            title={intl.formatMessage({
              id: ETranslations.global_select_network,
            })}
            variant="tertiary"
            icon="Document2Outline"
          />
        }
        renderContent={renderContent}
      />
    </XStack>
  );
}

export default memo(TokenDetailsTabToolbar);
