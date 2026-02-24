import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageQuestion = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 14h2v2.01h-2zm0-2.086c0-1.286.977-1.895 1.315-2.124l.004-.004a1.1 1.1 0 0 0 .267-.225.2.2 0 0 0 .026-.048.507.507 0 0 0-.49-.6.507.507 0 0 0-.499.515h-2c0-1.38 1.11-2.515 2.5-2.515s2.5 1.135 2.5 2.515c0 1.128-.743 1.716-1.18 2.012l-.005.003c-.204.14-.307.217-.377.3a.3.3 0 0 0-.046.073.3.3 0 0 0-.015.098v1h-2z" />
    <Path
      fillRule="evenodd"
      d="M21.002 3v16.036h-5.627l-3.38 2.802-3.343-2.802h-5.65V3zm-16 14.036h4.377L12 19.233l2.377-1.967.278-.23h4.347V5h-14z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageQuestion;
