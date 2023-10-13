import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBubble = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21.5 12c0-5-3.694-8-9.5-8s-9.5 3-9.5 8c0 1.294.894 3.49 1.037 3.83l.037.092c.098.266.49 1.66-1.074 3.722 2.111 1 4.353-.644 4.353-.644 1.551.815 3.397 1 5.147 1 5.806 0 9.5-3 9.5-8Z"
    />
  </Svg>
);
export default SvgBubble;
