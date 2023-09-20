import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDoubleLeft = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13.28 3.97a.75.75 0 0 1 0 1.06L6.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 0 1 1.06 0zm6 0a.75.75 0 0 1 0 1.06L12.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 0 1 1.06 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronDoubleLeft;
