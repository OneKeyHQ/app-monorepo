import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMacinthosh = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-1 1.732V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-1.268A2 2 0 0 1 4 17zm14 0H6v13h12zM7 6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1zm6 9a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMacinthosh;
