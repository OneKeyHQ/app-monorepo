import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgListSearch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4h13M4 9h5m-5 6h5m-5 5h13m2.728-4.272-1.607-1.607m0 0a3 3 0 1 0-4.242-4.243 3 3 0 0 0 4.242 4.243Z"
    />
  </Svg>
);
export default SvgListSearch;
