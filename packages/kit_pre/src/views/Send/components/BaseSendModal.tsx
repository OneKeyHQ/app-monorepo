import type { ComponentProps } from 'react';

import { Box, Modal, Text, Token } from '@onekeyhq/components';

import { LazyLoadingDisplayView } from '../../../components/LazyDisplayView';
import { useNetwork } from '../../../hooks';

export type IBaseSendModal = ComponentProps<typeof Modal> & {
  accountId: string;
  networkId: string;
};
function BaseSendModal(props: IBaseSendModal) {
  const { networkId } = props;
  const { network } = useNetwork({ networkId });
  const { children, scrollViewProps, ...restProps } = props;
  return (
    <Modal
      headerDescription={
        <Box flexDirection="row" alignItems="center" mt={0.5}>
          <Token
            size={4}
            mr={2}
            token={{
              logoURI: network?.logoURI,
              name: network?.shortName,
            }}
          />
          <Text textAlign="center" typography="Caption" color="text-subdued">
            {network?.name || network?.shortName || undefined}
          </Text>
        </Box>
      }
      onSecondaryActionPress={({ close }) => close()}
      {...restProps}
      scrollViewProps={
        scrollViewProps
          ? {
              ...scrollViewProps,
              children: scrollViewProps?.children ? (
                <LazyLoadingDisplayView>
                  {scrollViewProps?.children}
                </LazyLoadingDisplayView>
              ) : null,
            }
          : undefined
      }
    >
      {children ? (
        <LazyLoadingDisplayView>
          {children as React.ReactElement}
        </LazyLoadingDisplayView>
      ) : null}
    </Modal>
  );
}

export { BaseSendModal };
