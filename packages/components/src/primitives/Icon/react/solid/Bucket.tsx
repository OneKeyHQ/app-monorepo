import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBucket = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="m3.614 9 1.174 9.373A3 3 0 0 0 7.765 21h8.47a3 3 0 0 0 2.977-2.627L20.386 9H3.614ZM3 3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H3Z"
    />
  </Svg>
);
export default SvgBucket;
