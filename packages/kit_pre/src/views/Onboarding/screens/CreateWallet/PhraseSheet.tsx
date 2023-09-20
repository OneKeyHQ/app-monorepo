import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  MnemonicCard,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { wait } from '../../../../utils/helper';

import type { IBoxProps } from 'native-base';

type PhraseSheetProps = {
  onPressSavedPhrase?: () => void;
  mnemonic: string;
} & IBoxProps;

const PhraseSheet: FC<PhraseSheetProps> = ({
  onPressSavedPhrase,
  mnemonic,
  ...rest
}) => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  const onPressSavedPhrasePromise = useCallback(async () => {
    onPressSavedPhrase?.();
    await wait(3000);
  }, [onPressSavedPhrase]);

  return (
    <Box alignSelf="stretch" flex={1} {...rest}>
      <Text typography="Body2" color="text-subdued" textAlign="center" mb={4}>
        ↓ {intl.formatMessage({ id: 'content__click_below_to_copy' })} ↓
      </Text>
      <Box flex={1} mb={8}>
        <MnemonicCard mnemonic={mnemonic} />
      </Box>
      <Text typography="Body2" color="text-subdued" textAlign="center" mb={4}>
        {intl.formatMessage({ id: 'content__save_phrase_securely' })}
      </Text>
      <Button
        type="primary"
        size={isVerticalLayout ? 'xl' : 'base'}
        onPromise={onPressSavedPhrasePromise}
      >
        {intl.formatMessage({ id: 'action__i_have_saved_the_phrase' })}
      </Button>
    </Box>
  );
};

export default PhraseSheet;
