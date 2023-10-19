import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSearch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M11 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm-8 6a8 8 0 1 1 14.32 4.906l3.387 3.387a1 1 0 0 1-1.414 1.414l-3.387-3.387A8 8 0 0 1 3 11Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSearch;
