import { useCallback, useState } from 'react';
import type { FC } from 'react';

import {
  Badge,
  BottomSheetModal,
  Box,
  HStack,
  Icon,
  Text,
  Token,
  VStack,
} from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';

import { useNetwork } from '../../../../hooks';
import { showOverlay } from '../../../../utils/overlayUtils';
import { useDerivationPath } from '../../hooks/useDerivationPath';

import type { IDerivationOption } from '../../hooks/useDerivationPath';

const DerivationPathHeader: FC<{ networkId: string | undefined }> = ({
  networkId,
}) => {
  const { network } = useNetwork({ networkId });
  return (
    <Box>
      <Token
        size={4}
        showInfo
        showName
        showTokenVerifiedIcon={false}
        token={{ name: network?.name, logoURI: network?.logoURI }}
        nameProps={{
          typography: { sm: 'Caption', md: 'Caption' },
          color: 'text-subdued',
          ml: '-6px',
        }}
      />
    </Box>
  );
};

const DerivationOption: FC<{
  option: IDerivationOption;
  selectedOption: string;
  onPress: (option: IDerivationOption) => void;
  showSubDesc: boolean;
  showTemplate: boolean;
}> = ({ option, selectedOption, onPress, showSubDesc, showTemplate }) => (
  <Pressable mr="7px" my={2} onPress={() => onPress(option)}>
    <HStack alignItems="center" justifyContent="space-between">
      <VStack flex={1}>
        <HStack mb={1}>
          <Text typography={{ sm: 'Body1Strong', md: 'Body1Strong' }}>
            {option.label}
          </Text>
          {option.recommended && <Badge ml={2} size="sm" title="Recommanded" />}
          {option.notRecommended && (
            <Badge ml={2} size="sm" title="Not Recommended" />
          )}
        </HStack>
        <Text
          typography={{ sm: 'Body2Mono', md: 'Body2Mono' }}
          fontFamily="mono"
          color="text-subdued"
        >
          {option.desc}
        </Text>
        <Text
          typography={{ sm: 'Body2Mono', md: 'Body2Mono' }}
          fontFamily="mono"
          color="text-subdued"
        >
          {showTemplate && option.template.replace('x', '*')}
          {showSubDesc && option.subDesc}
        </Text>
      </VStack>
      {selectedOption === option.key && (
        <Icon size={14} name="CheckMini" color="icon-success" />
      )}
    </HStack>
  </Pressable>
);

const DerivationPathContent: FC<{ networkId: string | undefined }> = ({
  networkId,
}) => {
  const { derivationOptions, isBTCLikeCoin } = useDerivationPath(networkId);
  const [selectedOption, setSelectedOption] = useState('');

  const onSelect = useCallback((option: IDerivationOption) => {
    setSelectedOption(option.key);
  }, []);

  return (
    <Box>
      <Text typography={{ sm: 'Body2', md: 'Body2' }} mr="7px" mb={4}>
        {`If you don't see the accounts you expect, try switching the HD Path.`}
      </Text>

      <>
        {derivationOptions.map((option) => (
          <DerivationOption
            key={option.key}
            option={option}
            onPress={onSelect}
            selectedOption={selectedOption}
            showSubDesc={isBTCLikeCoin}
            showTemplate={!isBTCLikeCoin}
          />
        ))}
      </>
    </Box>
  );
};

function showDerivationPathBottomSheetModal(networkId: string | undefined) {
  showOverlay((close) => (
    <BottomSheetModal
      title="Derivation Path"
      headerDescription={<DerivationPathHeader networkId={networkId} />}
      closeOverlay={close}
    >
      <DerivationPathContent networkId={networkId} />
    </BottomSheetModal>
  ));
}

export default showDerivationPathBottomSheetModal;
