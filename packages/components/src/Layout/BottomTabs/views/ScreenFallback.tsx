import { ResourceSavingView } from '@react-navigation/elements';
import { StyleProp, View, ViewProps, ViewStyle } from 'react-native';

type Props = {
  visible: boolean;
  children: React.ReactNode;
  enabled: boolean;
  freezeOnBlur?: boolean;
  style?: StyleProp<ViewStyle>;
};

let Screens: typeof import('react-native-screens') | undefined;

try {
  // eslint-disable-next-line global-require
  Screens = require('react-native-screens');
} catch (e) {
  // Ignore
}

export const MaybeScreenContainer = ({
  enabled,
  ...rest
}: ViewProps & {
  enabled: boolean;
  hasTwoStates: boolean;
  children: React.ReactNode;
}) => {
  if (Screens?.screensEnabled?.()) {
    return <Screens.ScreenContainer enabled={enabled} {...rest} />;
  }

  return <View {...rest} />;
};

export function MaybeScreen({ visible, children, ...rest }: Props) {
  if (Screens?.screensEnabled?.()) {
    return (
      <Screens.Screen activityState={visible ? 2 : 0} {...rest}>
        {children}
      </Screens.Screen>
    );
  }

  return (
    <ResourceSavingView visible={visible} {...rest}>
      {children}
    </ResourceSavingView>
  );
}
