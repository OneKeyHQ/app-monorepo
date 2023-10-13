import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFilterSort = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6.002 5v14m0 0L3 16m3.002 3L9 16m3-9h8m-4 10h4m-6-5h6"
    />
  </Svg>
);
export default SvgFilterSort;
