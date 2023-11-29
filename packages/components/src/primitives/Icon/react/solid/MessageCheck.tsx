import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageCheck = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.002 3h12a3 3 0 0 1 3 3v10.036a3 3 0 0 1-3 3h-2.626l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-2.65a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm9.455 6.957a1 1 0 0 0-1.414-1.414l-2.793 2.793-.793-.793a1 1 0 0 0-1.414 1.414l1.5 1.5a1 1 0 0 0 1.414 0l3.5-3.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageCheck;
