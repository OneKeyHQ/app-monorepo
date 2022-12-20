import type { FC } from 'react';
import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Center,
  Hidden,
  PresenceTransition,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import PhraseSheet from '../PhraseSheet';

type SecondaryContentProps = {
  onPressShowPhraseButton?: () => void;
  onPressSavedPhrase?: () => void;
  mnemonic: string;
};

const defaultProps = {} as const;

const SecondaryContent: FC<SecondaryContentProps> = ({
  onPressShowPhraseButton,
  onPressSavedPhrase,
  mnemonic,
}) => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  const [showInpagePhrase, setIsShowInpagePhrase] = useState(false);

  return (
    <Center flex={{ sm: 1 }} mt="auto">
      {showInpagePhrase ? (
        <Hidden from="base" till="sm">
          <PresenceTransition
            visible={showInpagePhrase}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: {
                duration: 150,
              },
            }}
            style={{
              flex: 1,
              alignSelf: 'stretch',
            }}
          >
            <PhraseSheet
              mnemonic={mnemonic}
              onPressSavedPhrase={onPressSavedPhrase}
            />
          </PresenceTransition>
        </Hidden>
      ) : (
        <>
          <Hidden from="base" till="sm">
            <Text typography="Body2" mb={4} textAlign="center">
              {intl.formatMessage({
                id: 'content__read_information_on_the_left',
              })}
            </Text>
          </Hidden>
          <Button
            type="primary"
            size={isVerticalLayout ? 'xl' : 'base'}
            alignSelf={isVerticalLayout ? 'stretch' : 'auto'}
            onPress={
              isVerticalLayout
                ? onPressShowPhraseButton
                : () => {
                    setIsShowInpagePhrase(true);
                  }
            }
          >
            {intl.formatMessage({
              id: 'action__show_recovery_phrase',
            })}
          </Button>
        </>
      )}
    </Center>
  );
};

SecondaryContent.defaultProps = defaultProps;

export default SecondaryContent;
