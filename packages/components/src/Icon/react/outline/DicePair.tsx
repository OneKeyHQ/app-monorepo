import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDicePair = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2.365 14.136a2 2 0 0 1 .967-2.658l4.532-2.113a2 2 0 0 1 2.658.967l2.113 4.532a2 2 0 0 1-.968 2.658l-4.531 2.113a2 2 0 0 1-2.658-.967l-2.113-4.532Zm12.357-9.243a2 2 0 0 1 2.564-1.195l2.819 1.026A2 2 0 0 1 21.3 7.287l-1.026 2.82a2 2 0 0 1-2.563 1.195l-2.82-1.026a2 2 0 0 1-1.195-2.564l1.026-2.819Z"
    />
    <Path
      fill="currentColor"
      d="M6.41 13.352a1 1 0 1 1-1.812.845 1 1 0 0 1 1.812-.845Zm3.989 1.451a1 1 0 1 1-1.813.845 1 1 0 0 1 1.813-.845Zm8.041-6.961a1 1 0 1 1-1.88-.684 1 1 0 0 1 1.88.684Z"
    />
  </Svg>
);
export default SvgDicePair;
