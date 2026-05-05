import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSimCard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14 16h-4v-3h4z" />
    <Path
      fillRule="evenodd"
      d="M20 7.586V22H4V2h10.414zM8 18h8v-7H8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSimCard;
