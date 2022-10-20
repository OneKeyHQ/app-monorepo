import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSearchCircle = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 9a2 2 0 1 1 4 0 2 2 0 0 1-4 0z" />
    <Path
      fillRule="evenodd"
      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm1-13a4 4 0 0 0-3.446 6.032l-2.261 2.26a1 1 0 1 0 1.414 1.415l2.261-2.261A4 4 0 1 0 11 5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSearchCircle;
