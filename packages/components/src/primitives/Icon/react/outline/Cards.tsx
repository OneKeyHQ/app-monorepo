import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCards = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 8v2H6V8z" />
    <Path
      fillRule="evenodd"
      d="M18 4v4h4v12H6v-4H2V4zm0 12H8v2h12v-8h-2zM4 14h12V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCards;
