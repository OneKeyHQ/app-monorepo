import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDoubleDown = (props: SvgProps) => (
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
      d="m19.5 5.25-7.5 7.5-7.5-7.5m15 6-7.5 7.5-7.5-7.5"
    />
  </Svg>
);
export default SvgChevronDoubleDown;
