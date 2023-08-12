import { StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { s } from 'react-native-size-matters/extend';

import useNavigation from '../../../hooks/useNavigation';

type BackButtonProps = {
  style?: ViewStyle;
  color?: string;
  iconSize?: number;
};

const styles = StyleSheet.create({
  container: {
    opacity: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
    left: s(20),
    width: s(48),
    height: s(48),
  },
});

export const BackButton = ({ style, color, iconSize }: BackButtonProps) => {
  const { top } = useSafeAreaInsets();
  const navigation = useNavigation();
  return (
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      style={StyleSheet.flatten([
        styles.container,
        {
          position: 'absolute',
          top: top === 0 ? s(20) : top,
        },
        style,
      ])}
    >
      {/* <Icon
        name="chevron-back"
        color={color ? color : globalTheme.colors.white}
        size={iconSize ? iconSize : s(28)}
      /> */}
    </TouchableOpacity>
  );
};
