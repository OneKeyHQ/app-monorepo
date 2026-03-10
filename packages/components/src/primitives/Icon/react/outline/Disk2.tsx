import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDisk2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 10a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M21 6.586V21H3V3h14.414zM5 19h14V7.414L16.586 5H16v4H8V5H5zm5-12h4V5h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDisk2;
