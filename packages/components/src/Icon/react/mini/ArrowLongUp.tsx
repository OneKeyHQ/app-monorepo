import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowLongUp = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10 18a.75.75 0 0 1-.75-.75V4.66L7.3 6.76a.75.75 0 1 1-1.1-1.02l3.25-3.5a.75.75 0 0 1 1.1 0l3.25 3.5a.75.75 0 0 1-1.1 1.02l-1.95-2.1v12.59A.75.75 0 0 1 10 18z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowLongUp;
