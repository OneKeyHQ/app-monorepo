import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgColumnWide = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 4v16H2V4zm-9 14h7V6h-7zm-9 0h7V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgColumnWide;
