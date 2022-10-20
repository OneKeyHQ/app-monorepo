import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowUpTop = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3 3a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm3.293 7.707a1 1 0 0 1 0-1.414l3-3a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1-1.414 1.414L11 9.414V17a1 1 0 1 1-2 0V9.414l-1.293 1.293a1 1 0 0 1-1.414 0Z"
    />
  </Svg>
);
export default SvgArrowUpTop;
