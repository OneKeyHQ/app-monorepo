import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBubbles = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Zm6.5 11a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm.5-3.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z"
    />
  </Svg>
);
export default SvgBubbles;
