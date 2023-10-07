import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useHeaderHeight as useHeaderHeightOG } from '@react-navigation/elements';
import { KeyboardAvoidingView, Platform } from 'react-native';
import {
  ScrollView,
  YStack,
  useWindowDimensions,
  withStaticProperties,
} from 'tamagui';

import type { TamaguiElement, YStackProps } from 'tamagui';

const useHeaderHeight = () => {
  try {
    return useHeaderHeightOG();
  } catch (error) {
    return 0;
  }
};

const FormWrapperContext = createContext<{ height: number } | null>(null);

// eslint-disable-next-line react/display-name
const Wrapper = forwardRef<TamaguiElement, YStackProps>((props, ref) => {
  const [height, setHeight] = useState(0);
  const value = useMemo(() => ({ height }), [height]);
  return (
    <FormWrapperContext.Provider value={value}>
      <YStack
        onLayout={(event) => {
          setHeight(event.nativeEvent.layout.height);
        }}
        ref={ref}
        gap="$4"
        flex={1}
        jc="center"
        $gtSm={{
          width: '100%',
          maxWidth: 600,
          als: 'center',
        }}
        // $gtSm={{ width: 500, mx: 'auto' }}
        $sm={{ jc: 'space-between' }}
        {...props}
      />
    </FormWrapperContext.Provider>
  );
});

// eslint-disable-next-line react/display-name
const Body = forwardRef<TamaguiElement, YStackProps>((props, ref) => (
  <ScrollView>
    <YStack p="$4" ref={ref} gap="$2" pb="$8" {...props} />
  </ScrollView>
));

/**
 * on native, this will be pushed to the bottom of the screen
 */
// eslint-disable-next-line react/display-name
const Footer = forwardRef<TamaguiElement, YStackProps>((props, ref) => {
  const dimensions = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  const formWrapperContext = useContext(FormWrapperContext);
  const modalOffsetFromTop = formWrapperContext
    ? dimensions.height - formWrapperContext.height
    : headerHeight;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={modalOffsetFromTop}
    >
      <YStack
        ref={ref}
        pb="$4"
        px="$4"
        gap="$4"
        flexDirection="column-reverse"
        {...props}
      />
    </KeyboardAvoidingView>
  );
});

export const FormWrapper = withStaticProperties(Wrapper, {
  Body,
  Footer,
});
