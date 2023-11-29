import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgStopwatch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M10 1a1 1 0 0 0 0 2h4a1 1 0 1 0 0-2h-4Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M21 13a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8.293 10.707a1 1 0 0 1 1.414-1.414l3 3a1 1 0 0 1-1.414 1.414l-3-3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgStopwatch;
