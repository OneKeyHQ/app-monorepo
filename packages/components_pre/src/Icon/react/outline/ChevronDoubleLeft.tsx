import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDoubleLeft = (props: SvgProps) => (
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
      d="m18.75 19.5-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"
    />
  </Svg>
);
export default SvgChevronDoubleLeft;
