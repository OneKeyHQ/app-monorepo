import { FC, useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Box,
  Button,
  Center,
  ScrollView,
  Select,
  Switch,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import {
  RootRoutes,
  RootRoutesParams,
  TabRoutesParams,
} from '../../../routes/types';
import LayoutContainer from '../../Onboarding/Layout';
import { KeyTagImportMatrix } from '../Component/KeyTagMatrix/keyTagImportMatrix';
import { generalKeyTagMnemonic, keyTagWordDataToMnemonic } from '../utils';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EOnboardingRoutes } from '../../Onboarding/routes/enums';
import { IOnboardingRoutesParams } from '../../Onboarding/routes/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { IKeytagRoutesParams } from '../Routes/types';
import { KeyTagRoutes } from '../Routes/enums';
import useAppNavigation from '../../../hooks/useAppNavigation';

type NavigationProps = StackNavigationProp<
  IKeytagRoutesParams,
  KeyTagRoutes.ImportKeytag
>;

const ImportKeyTag: FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const appNavigation = useAppNavigation();
  const [wordCount, setWordCount] = useState(12);
  const [mnemonicWordDatas, setMnemonicWordDatas] = useState(() =>
    generalKeyTagMnemonic(wordCount),
  );

  const onKeyTagChenge = useCallback(
    (wordIndex: number, index: number, value: boolean) => {
      console.log('wordIndex', wordIndex);
      console.log('index', index);
      console.log('value', value);
      const newMnemonicWordDatas = [...mnemonicWordDatas];
      const changeMnemonicWord = newMnemonicWordDatas.find(
        (item) => item.index === wordIndex,
      );
      if (changeMnemonicWord && changeMnemonicWord.dotMapData) {
        changeMnemonicWord.dotMapData[index] = value;
        const { mnemonicWord, mnemonicIndexNumber, status } =
          keyTagWordDataToMnemonic(changeMnemonicWord.dotMapData);
        changeMnemonicWord.mnemonicWord = mnemonicWord;
        changeMnemonicWord.mnemonicIndexNumber = mnemonicIndexNumber;
        changeMnemonicWord.status = status;
        console.log('mnemonicWordDatas------', newMnemonicWordDatas);
        setMnemonicWordDatas(newMnemonicWordDatas);
      }
    },
    [mnemonicWordDatas],
  );

  const importValidation = useCallback(() => {
    const mnemonic = mnemonicWordDatas
      .map((item) => item.mnemonicWord)
      .join(' ');
    console.log('mnemonic', mnemonic);
    appNavigation.navigate(RootRoutes.Onboarding, {
      screen: EOnboardingRoutes.SetPassword,
      params: { mnemonic },
    });
  }, [appNavigation, mnemonicWordDatas]);
  navigation.setOptions({
    headerShown: true,
    headerRight: () => (
      <Button type="primary" size="base" onPress={importValidation}>
        Import
      </Button>
    ),
    headerTitle: () => <Box />,
  });
  const [showResult, setShowResult] = useState(true);
  const isVertical = useIsVerticalLayout();
  return (
    <LayoutContainer backButton={false}>
      <Box
        flexDirection={isVertical ? 'column' : 'row'}
        justifyContent={isVertical ? 'center' : 'space-between'}
      >
        <Box>
          <Typography.DisplayLarge>
            Import Wallet with KeyTag
          </Typography.DisplayLarge>
          <Typography.Body1>
            Fill the blank according to your KeyTag backup.
          </Typography.Body1>
        </Box>
        <Box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box flexDirection="row" alignItems="center" mr={4}>
            <Switch
              labelType="false"
              isChecked={showResult}
              mr={2}
              onToggle={() => setShowResult(!showResult)}
            />
            <Typography.Body2Strong>Show Result</Typography.Body2Strong>
          </Box>
          <Box>
            <Select
              defaultValue={wordCount}
              onChange={(v, item) => {
                setWordCount(item.value);
                setMnemonicWordDatas(
                  generalKeyTagMnemonic(item.value, mnemonicWordDatas),
                );
              }}
              options={[
                { label: '12 words', value: 12 },
                { label: '18 words', value: 18 },
                { label: '24 words', value: 24 },
              ]}
            />
          </Box>
        </Box>
      </Box>
      <Box flex="1">
        <ScrollView>
          <Box flexDirection={isVertical ? 'column' : 'row'}>
            {mnemonicWordDatas.length > 12 ? (
              <>
                <KeyTagImportMatrix
                  onChange={onKeyTagChenge}
                  keyTagData={mnemonicWordDatas.slice(0, 12)}
                />
                <KeyTagImportMatrix
                  keyTagData={mnemonicWordDatas.slice(12)}
                  onChange={onKeyTagChenge}
                />
              </>
            ) : (
              <KeyTagImportMatrix
                keyTagData={mnemonicWordDatas}
                onChange={onKeyTagChenge}
              />
            )}
          </Box>
        </ScrollView>
      </Box>
    </LayoutContainer>
  );
};

export default ImportKeyTag;
