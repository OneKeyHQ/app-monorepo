import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgToolbox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m8.484 2 2.52 3.15V10H12V2h8v8h2v11H2V10h2.004V5.15L6.524 2zm-2.48 3.85V10h3V5.85L7.524 4h-.04zM14 6h2.004v2H14v2h4V4h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgToolbox;
