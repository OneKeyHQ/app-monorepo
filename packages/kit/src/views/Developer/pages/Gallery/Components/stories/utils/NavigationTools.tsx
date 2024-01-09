import { useEffect } from 'react';

import { useIsFocused } from '@react-navigation/core';

import { SizableText } from '@onekeyhq/components';
// import useIsActiveTab from '@onekeyhq/components/src/TabView/hooks/useIsActiveTab';

export function NavigationFocusTools({
  componentName,
}: {
  componentName: string;
}) {
  const isFocused = useIsFocused();

  useEffect(() => {
    console.log(
      `<=== NavigationFocus: ${componentName} isFocused: ${
        isFocused ? 'true' : 'false'
      }`,
    );
  }, [componentName, isFocused]);

  return (
    <SizableText>
      {componentName} isFocused: {isFocused ? 'true' : 'false'}
    </SizableText>
  );
}
