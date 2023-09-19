import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDoubleDown = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.77 4.21a.75.75 0 0 1 .02 1.06l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 1.08-1.04L10 8.168l3.71-3.938a.75.75 0 0 1 1.06-.02zm0 6a.75.75 0 0 1 .02 1.06l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 1 1 1.08-1.04L10 14.168l3.71-3.938a.75.75 0 0 1 1.06-.02z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronDoubleDown;
