import type { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Center,
  HStack,
  Typography,
  VStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';

import { showOverlay } from '../../../utils/overlayUtils';
import { BottomSheetSettings } from '../../Overlay/BottomSheetSettings';
import SvgRevoke from '../Svg';

export type ActionKey = 'share' | 'copy' | 'change' | 'revoke';

const About: FC<{
  closeOverlay: () => void;
}> = () => {
  const intl = useIntl();
  const insets = useSafeAreaInsets();
  return (
    <VStack pb={`${insets.bottom}px`} px="4" pt="6">
      <Center>
        <SvgRevoke />
      </Center>
      <HStack mt="8">
        <Typography.Body1>✅</Typography.Body1>
        <Typography.Body1 ml="2">
          {intl.formatMessage({
            id: 'content__manage_your_token_allowances_and_protect_yourself_from_scams_on_30_chains',
          })}
        </Typography.Body1>
      </HStack>
      <HStack mt="2">
        <Typography.Body1>✅</Typography.Body1>
        <Typography.Body1 ml="2">
          {intl.formatMessage({
            id: 'content__support_malicious_contract_detection_on_8_chains',
          })}
          <Badge
            title={intl.formatMessage({ id: 'badge__coming_soon' })}
            size="sm"
            bg="surface-highlight-default"
            ml="1"
          />
        </Typography.Body1>
      </HStack>
    </VStack>
  );
};

const showAboutOverlay = () => {
  showOverlay((closeOverlay) => (
    <BottomSheetSettings
      closeOverlay={closeOverlay}
      titleI18nKey="title__about"
    >
      <About closeOverlay={closeOverlay} />
    </BottomSheetSettings>
  ));
};
export default showAboutOverlay;
