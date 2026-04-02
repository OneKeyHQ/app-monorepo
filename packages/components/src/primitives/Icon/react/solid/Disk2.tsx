import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDisk2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 13a2 2 0 1 1 0 4 2 2 0 0 1 0-4" />
    <Path
      fillRule="evenodd"
      d="M8 3v6h8V3h1.414L21 6.586V21H3V3zm4 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8"
      clipRule="evenodd"
    />
    <Path d="M14 3v4h-4V3z" />
  </Svg>
);
export default SvgDisk2;
