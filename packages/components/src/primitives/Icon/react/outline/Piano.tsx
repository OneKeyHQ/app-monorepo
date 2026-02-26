import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPiano = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 22H3V3h18zM5 20h3v-6H6.5V5H5zm6.5-6H10v6h4v-6h-1.5V5h-1zm6 0H16v6h3V5h-1.5zm-9-2h1V5h-1zm6 0h1V5h-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPiano;
