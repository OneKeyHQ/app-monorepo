import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMap = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="m14 4.863-4-1.334v15.108l4 1.334V4.863Zm2 15.107 4.29-1.43A2.5 2.5 0 0 0 22 16.17V6.33a2.5 2.5 0 0 0-3.29-2.372L16 4.863V19.97ZM3.71 4.96 8 3.53v15.107l-2.71.904A2.5 2.5 0 0 1 2 17.169V7.33a2.5 2.5 0 0 1 1.71-2.37Z"
    />
  </Svg>
);
export default SvgMap;
