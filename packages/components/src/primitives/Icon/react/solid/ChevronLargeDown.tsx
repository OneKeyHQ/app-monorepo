import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronLargeDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2.126 9.515a1 1 0 0 1 1.36-.389l8.028 4.46a1 1 0 0 0 .972 0l8.028-4.46a1 1 0 0 1 .972 1.748l-8.03 4.46a3 3 0 0 1-2.913 0l-8.029-4.46a1 1 0 0 1-.388-1.36Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronLargeDown;
