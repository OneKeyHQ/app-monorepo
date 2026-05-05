import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLuggagePackage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 17H8V9h2zm6 0h-2V9h2z" />
    <Path
      fillRule="evenodd"
      d="M16 5h5v16h-3v1h-2v-1H8v1H6v-1H3V5h5V2h8zM5 19h14V7H5zm5-14h4V4h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLuggagePackage;
