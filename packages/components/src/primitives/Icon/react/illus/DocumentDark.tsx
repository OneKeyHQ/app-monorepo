import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentDark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path fill="#fff" d="M48 32h88v113H48z" />
    <Path
      fill="#000"
      stroke="#fff"
      strokeLinejoin="round"
      d="M46.5 34.5h87v112h-87z"
    />
    <Path
      stroke="#fff"
      d="M120 44v12l4-3.5M115 57V45l-4 3.5M56 46h20M56 55h37M56 136h19"
    />
  </Svg>
);
export default SvgDocumentDark;
