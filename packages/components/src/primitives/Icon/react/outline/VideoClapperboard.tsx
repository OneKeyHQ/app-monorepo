import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVideoClapperboard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 10h18M3 10v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M3 10V7a2 2 0 0 1 2-2h3m-5 5h4m14 0V7a2 2 0 0 0-2-2h-2m4 5h-5m-4.5 0 1-5m-1 5H7m4.5 0H16m-3.5-5H8m4.5 0H17M8 5l-1 5m10-5-1 5"
    />
  </Svg>
);
export default SvgVideoClapperboard;
