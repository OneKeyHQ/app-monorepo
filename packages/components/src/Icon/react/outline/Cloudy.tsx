import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudy = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 19H9a7 7 0 1 1 6.024-10.568c.264.446.793.681 1.307.612A5 5 0 1 1 17 19Z"
    />
  </Svg>
);
export default SvgCloudy;
