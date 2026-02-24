import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAirplay = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18.081 21H5.92L12 13.4zm-8-2h3.838L12 16.602z"
      clipRule="evenodd"
    />
    <Path d="M22 3v15h-4.5v-2H20V5H4v11h2.5v2H2V3z" />
  </Svg>
);
export default SvgAirplay;
