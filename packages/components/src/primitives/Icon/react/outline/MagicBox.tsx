import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicBox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 15H9v-2h6z" />
    <Path
      fillRule="evenodd"
      d="M20.372 4.657 17.766 9H20v13H4V9h11.434l3.223-5.372 1.715 1.03ZM6 20h12v-9H6z"
      clipRule="evenodd"
    />
    <Path d="m8.328 4.672 1.658.828-1.658.828L7.5 7.986l-.828-1.658L5.014 5.5l1.658-.828.828-1.658zm5.567-1.869.1.202.202.1 1.79.895-1.79.895-.202.1-.1.202L13 6.987l-.895-1.79-.1-.202-.202-.1L10.013 4l1.79-.895.202-.1.1-.202.895-1.79z" />
  </Svg>
);
export default SvgMagicBox;
