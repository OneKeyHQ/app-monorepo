import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCup1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M4 4h12v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z"
    />
  </Svg>
);
export default SvgCup1;
