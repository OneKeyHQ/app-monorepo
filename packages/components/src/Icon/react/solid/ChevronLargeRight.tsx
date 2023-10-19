import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronLargeRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9.514 2.126a1 1 0 0 1 1.36.389l4.46 8.028a3 3 0 0 1 0 2.914l-4.46 8.029a1 1 0 1 1-1.748-.971l4.46-8.03a1 1 0 0 0 0-.97l-4.46-8.03a1 1 0 0 1 .388-1.359Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronLargeRight;
