import { useTheme } from '@react-navigation/native';
import {
  Animated,
  Platform,
  StyleProp,
  StyleSheet,
  ViewProps,
  ViewStyle,
} from 'react-native';

type Props = Omit<ViewProps, 'style'> & {
  style?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  children?: React.ReactNode;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...Platform.select({
      android: {
        elevation: 4,
      },
      ios: {
        shadowOpacity: 0.85,
        shadowRadius: 0,
        shadowOffset: {
          width: 0,
          height: StyleSheet.hairlineWidth,
        },
      },
      default: {
        borderBottomWidth: StyleSheet.hairlineWidth,
      },
    }),
  },
});

export default function HeaderBackground({ style, ...rest }: Props) {
  const { colors } = useTheme();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          shadowColor: colors.border,
        },
        style,
      ]}
      {...rest}
    />
  );
}
