import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSimCard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16 18H8v-7h8zm-6-2h4v-3h-4z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M20 7.586V22H4V2h10.414zM6 20h12V8.414L13.586 4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSimCard;
