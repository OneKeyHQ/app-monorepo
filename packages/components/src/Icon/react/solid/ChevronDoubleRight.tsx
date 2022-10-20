import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDoubleRight = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10.293 15.707a1 1 0 0 1 0-1.414L14.586 10l-4.293-4.293a1 1 0 1 1 1.414-1.414l5 5a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M4.293 15.707a1 1 0 0 1 0-1.414L8.586 10 4.293 5.707a1 1 0 0 1 1.414-1.414l5 5a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronDoubleRight;
