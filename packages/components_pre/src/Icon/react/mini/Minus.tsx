import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMinus = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMinus;
