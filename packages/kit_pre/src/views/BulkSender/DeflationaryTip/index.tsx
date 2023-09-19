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
        {intl.formatMessage({ id: 'content__deflationary_desc' })}
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
