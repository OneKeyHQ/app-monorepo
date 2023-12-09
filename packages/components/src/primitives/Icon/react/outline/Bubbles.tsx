import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBubbles = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M13 8A5 5 0 1 1 3 8a5 5 0 0 1 10 0Zm5 9.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm3-8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"
    />
  </Svg>
);
export default SvgBubbles;
