import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDoubleUp = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m4.5 12.75 7.5-7.5 7.5 7.5m-15 6 7.5-7.5 7.5 7.5"
    />
  </Svg>
);
export default SvgChevronDoubleUp;
