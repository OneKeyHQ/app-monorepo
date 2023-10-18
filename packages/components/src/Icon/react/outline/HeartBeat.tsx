import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHeartBeat = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 12h-1.5L13 14l-2.5-4-1.25 2H8m4-6.232c6.162-6.25 16.725 5.358 0 14.732C-4.725 11.126 5.838-.482 12 5.768Z"
    />
  </Svg>
);
export default SvgHeartBeat;
