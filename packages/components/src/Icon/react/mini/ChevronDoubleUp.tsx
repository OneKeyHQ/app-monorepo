import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDoubleUp = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5.23 15.79a.75.75 0 0 1-.02-1.06l4.25-4.5a.75.75 0 0 1 1.08 0l4.25 4.5a.75.75 0 1 1-1.08 1.04L10 11.832 6.29 15.77a.75.75 0 0 1-1.06.02zm0-6a.75.75 0 0 1-.02-1.06l4.25-4.5a.75.75 0 0 1 1.08 0l4.25 4.5a.75.75 0 1 1-1.08 1.04L10 5.832 6.29 9.77a.75.75 0 0 1-1.06.02z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronDoubleUp;
