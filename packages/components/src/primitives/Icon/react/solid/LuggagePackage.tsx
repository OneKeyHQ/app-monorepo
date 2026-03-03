import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLuggagePackage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16 5h5v16h-3v1h-2v-1H8v1H6v-1H3V5h5V2h8zM8 9v8h2V9zm6 0v8h2V9zm-4-4h4V4h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLuggagePackage;
