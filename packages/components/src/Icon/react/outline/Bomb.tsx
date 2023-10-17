import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBomb = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m15 9 2-2m0-4V2m3 2 1-1m0 4h1m-5 7a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
    />
  </Svg>
);
export default SvgBomb;
