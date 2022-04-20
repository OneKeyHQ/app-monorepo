import React, { useEffect, useState } from 'react';

import {
  Box,
  Button,
  CheckBox,
  ScrollView,
  Typography,
} from '@onekeyhq/components';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { navigationGoBack } from '../../../hooks/useAppNavigation';

function DebugLoggerSettings() {
  const [groupValue, setGroupValue] = React.useState<string[]>([]);
  const [keys, setKeys] = React.useState<string[]>([]);
  const [savedStr, setSavedStr] = React.useState('');
  useEffect(() => {
    setTimeout(() => {
      const allKeys = Object.keys(debugLogger).filter((key) => key !== 'debug');
      setKeys(allKeys);

      debugLogger?.debug?.load().then((ns) => {
        const savedNs = ns || '';
        setSavedStr(savedNs);
        setGroupValue(savedNs.split(',').filter((k) => allKeys.includes(k)));
      });
    }, 500);
  }, []);
  return (
    <Box>
      <Typography.DisplayXLarge>debugLogger</Typography.DisplayXLarge>
      <CheckBox.Group
        accessibilityLabel="choose multiple items"
        value={groupValue}
        onChange={(values: string[]) => {
          setGroupValue(values || []);
          const valuesWithWildcards = [
            ...values,
            ...values.map((v) => `${v}:*`),
          ].sort();
          const savedValues = valuesWithWildcards.join(',');
          setSavedStr(savedValues);
          debugLogger?.debug?.enable(savedValues);
        }}
        alignItems="flex-start"
      >
        {keys.map((key) => (
          <CheckBox key={key} value={key}>
            {key}
          </CheckBox>
        ))}
      </CheckBox.Group>
      <Box _text={{ color: 'text-default' }}>{`config = ${savedStr}`}</Box>
    </Box>
  );
}

function InjectedSettings() {
  const [checked, setChecked] = useState(false);

  return (
    <Box>
      <Typography.DisplayXLarge>Injected</Typography.DisplayXLarge>
      <CheckBox
        onChange={(isSelected) => setChecked(isSelected)}
        isChecked={checked}
        title="inject [RELOAD] button"
      />
    </Box>
  );
}

const LoggerGallery = () => (
  // const navigation = useNavigation();
  <ScrollView p={4} flex="1" bg="background-hovered">
    <Button onPress={navigationGoBack}>Back to HOME</Button>
    <DebugLoggerSettings />
    <InjectedSettings />
  </ScrollView>
);
export default LoggerGallery;
