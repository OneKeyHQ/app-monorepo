import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Select,
  Switch,
  ToastManager,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { HomeRoutes } from '../../../routes/types';
import LayoutContainer from '../../Onboarding/Layout';
import { EOnboardingRoutes } from '../../Onboarding/routes/enums';
import { KeyTagImportMatrix } from '../Component/KeyTagMatrix/keyTagImportMatrix';
import { KeyTagMnemonicStatus } from '../types';
import { generalKeyTagMnemonic, keyTagWordDataToMnemonic } from '../utils';

import type { HomeRoutesParams, ModalScreenProps } from '../../../routes/types';
import type { KeyTagRoutes } from '../Routes/enums';
import type { IKeytagRoutesParams } from '../Routes/types';
import type { StackNavigationProp } from '@react-navigation/stack';

type NavigationProps = StackNavigationProp<
  IKeytagRoutesParams,
  KeyTagRoutes.ImportKeytag
> &
  ModalScreenProps<HomeRoutesParams>;

const ImportKeyTag: FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const [importCheck, setImportCheck] = useState(false);
  const [mnemonicWordDatas, setMnemonicWordDatas] = useState(() =>
    generalKeyTagMnemonic(12),
  );

  const onKeyTagChenge = useCallback(
    (wordIndex: number, index: number, value: boolean) => {
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
        setMnemonicWordDatas(newMnemonicWordDatas);
      }
    },
    [mnemonicWordDatas],
  );

  const importValidation = useCallback(async () => {
    setImportCheck(true);
    let checkMnemonicWordDatas = [...mnemonicWordDatas];
    checkMnemonicWordDatas = checkMnemonicWordDatas.map((item) => {
      const { mnemonicWord, mnemonicIndexNumber, status } =
        keyTagWordDataToMnemonic(item.dotMapData ?? []);
      return {
        ...item,
        mnemonicWord,
        mnemonicIndexNumber,
        status,
      };
    });
    setMnemonicWordDatas(checkMnemonicWordDatas);
    if (
      checkMnemonicWordDatas.every(
        (item) => item.status === KeyTagMnemonicStatus.VERIF,
      )
    ) {
      const mnemonic = checkMnemonicWordDatas
        .map((item) => item.mnemonicWord)
        .join(' ');
      try {
        await backgroundApiProxy.validator.validateMnemonic(mnemonic);
        navigation.navigate(HomeRoutes.HomeOnboarding, {
          screen: EOnboardingRoutes.SetPassword,
          params: { mnemonic },
        });
      } catch (e) {
        ToastManager.show(
          {
            title: intl.formatMessage({ id: 'msg__engine__invalid_mnemonic' }),
          },
          { type: 'error' },
        );
        console.error('validate mnemonic', e);
      }
    } else {
      ToastManager.show(
        { title: intl.formatMessage({ id: 'msg__engine__invalid_mnemonic' }) },
        { type: 'error' },
      );
    }
    setImportCheck(false);
  }, [navigation, mnemonicWordDatas, intl]);
  const rightButton = useMemo(
    () => (
      <Button
        mt={isVertical ? 2 : 4}
        mr={platformEnv.isNative ? 0 : 6}
        type="primary"
        size="base"
        isLoading={importCheck}
        onPress={importValidation}
      >
        {intl.formatMessage({ id: 'action__import' })}
      </Button>
    ),
    [importCheck, importValidation, intl, isVertical],
  );
  const LeftButton = useMemo(
    () =>
      !platformEnv.isNativeAndroid ? (
        <Button
          ml={2}
          mt={isVertical ? 2 : 4}
          type="plain"
          leftIconName="ChevronLeftOutline"
          onPress={() => {
            if (navigation?.canGoBack?.()) {
              navigation.goBack();
            }
          }}
        />
      ) : null,
    [isVertical, navigation],
  );
  const title = useMemo(() => <Box />, []);
  navigation.setOptions({
    headerShown: true,
    headerLeft: () => LeftButton,
    headerRight: () => rightButton,
    headerTitle: () => title,
    headerShadowVisible: false,
  });
  const [showResult, setShowResult] = useState(true);
  return (
    <LayoutContainer backButton={false}>
      <Box
        flexDirection={isVertical ? 'column' : 'row'}
        justifyContent={isVertical ? 'center' : 'space-between'}
      >
        <Box mt={platformEnv.isNative ? -12 : 0}>
          <Typography.DisplayLarge>
            {intl.formatMessage({ id: 'title__import_wallet_with_keytag' })}
          </Typography.DisplayLarge>
          <Typography.Body1>
            {intl.formatMessage({
              id: 'title__import_wallet_with_keytag_desc',
            })}
          </Typography.Body1>
        </Box>
        <Box
          mt={4}
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
            <Typography.Body2Strong>
              {intl.formatMessage({ id: 'action__show_result' })}
            </Typography.Body2Strong>
          </Box>
          <Box>
            <Select
              activatable={!!isVertical}
              defaultValue={12}
              containerProps={{
                width: '130px',
                zIndex: 5,
              }}
              footer={null}
              headerShown={false}
              onChange={(v, item: { label: string; value: number }) => {
                setTimeout(() => {
                  setMnemonicWordDatas(
                    generalKeyTagMnemonic(item.value, mnemonicWordDatas),
                  );
                }, 200);
              }}
              options={[
                {
                  label: intl.formatMessage(
                    {
                      id: 'form__str_words',
                    },
                    { 0: 12 },
                  ),
                  value: 12,
                },
                {
                  label: intl.formatMessage(
                    {
                      id: 'form__str_words',
                    },
                    { 0: 18 },
                  ),
                  value: 18,
                },
                {
                  label: intl.formatMessage(
                    {
                      id: 'form__str_words',
                    },
                    { 0: 24 },
                  ),
                  value: 24,
                },
              ]}
            />
          </Box>
        </Box>
      </Box>
      <Box flex="1">
        <Box
          mt={6}
          justifyContent="space-around"
          alignItems={isVertical ? 'center' : 'flex-start'}
          flexDirection={isVertical ? 'column' : 'row'}
        >
          {mnemonicWordDatas.length > 12 ? (
            <>
              <KeyTagImportMatrix
                showResult={showResult}
                onChange={onKeyTagChenge}
                keyTagData={mnemonicWordDatas.slice(0, 12)}
              />
              <KeyTagImportMatrix
                showResult={showResult}
                startIndex={13}
                keyTagData={mnemonicWordDatas.slice(12)}
                onChange={onKeyTagChenge}
              />
            </>
          ) : (
            <KeyTagImportMatrix
              showResult={showResult}
              keyTagData={mnemonicWordDatas}
              onChange={onKeyTagChenge}
            />
          )}
        </Box>
      </Box>
    </LayoutContainer>
  );
};

export default ImportKeyTag;
