import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGiroCard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 11H6V9h3z" />
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4 18h16V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgGiroCard;
