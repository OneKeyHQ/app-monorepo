import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUser = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-6.535 6.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003z" />
  </Svg>
);
export default SvgUser;
