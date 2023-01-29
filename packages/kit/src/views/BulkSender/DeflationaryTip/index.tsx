import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Button,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { showOverlay } from '../../../utils/overlayUtils';

function DeflationaryTipBottomSheetModal({
  closeOverlay,
}: {
  closeOverlay: () => void;
}) {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();

  return (
    <BottomSheetModal
      closeOverlay={closeOverlay}
      showCloseButton={!isVertical}
      title={intl.formatMessage({ id: 'action__deflationary' })}
    >
      <Text typography="Body1">
        Please ignore this if your token isn't deflationary.Most tokens are not,
        so leave it as is. If your token has deflationary functions, such as
        token dividends, burning, taxes, etc., please enable this!
      </Text>
      <Text typography="Body1" mt={7}>
        If you are the token owner and there is an automatic LP function and you
        have not added a liquidity pool, please turn off the automatic LP first!
      </Text>

      <Button size="xl" type="primary" onPress={closeOverlay} mt={7}>
        {intl.formatMessage({ id: 'action__i_got_it' })}
      </Button>
    </BottomSheetModal>
  );
}

const showDeflationaryTip = () => {
  showOverlay((close) => (
    <DeflationaryTipBottomSheetModal closeOverlay={close} />
  ));
};

export { showDeflationaryTip };
