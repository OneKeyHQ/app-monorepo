import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDisk2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 15a2 2 0 1 1 4 0 2 2 0 0 1-4 0" />
    <Path
      fillRule="evenodd"
      d="M5 3h3v5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3h.586A2 2 0 0 1 18 3.586L20.414 6A2 2 0 0 1 21 7.414V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m7 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8"
      clipRule="evenodd"
    />
    <Path d="M10 3h4v4h-4z" />
  </Svg>
);
export default SvgDisk2;
