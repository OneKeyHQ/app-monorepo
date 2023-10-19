import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWatchSquare = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 19h10M7 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2m0 14 .772 2.316a1 1 0 0 0 .949.684h6.558a1 1 0 0 0 .949-.684L17 19m0 0a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m0 0H7m10 0-.772-2.316A1 1 0 0 0 15.279 2H8.721a1 1 0 0 0-.949.684L7 5m5 4v3l1.5 1.5"
    />
  </Svg>
);
export default SvgWatchSquare;
