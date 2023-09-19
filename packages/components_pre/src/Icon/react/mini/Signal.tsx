import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSignal = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16.364 3.636a.75.75 0 0 0-1.06 1.06 7.5 7.5 0 0 1 0 10.607.75.75 0 0 0 1.06 1.061 9 9 0 0 0 0-12.728zM4.697 4.697a.75.75 0 0 0-1.061-1.06 9 9 0 0 0 0 12.727.75.75 0 1 0 1.06-1.06 7.5 7.5 0 0 1 0-10.607z" />
    <Path d="M12.475 6.465a.75.75 0 0 1 1.06 0 5 5 0 0 1 0 7.07.75.75 0 1 1-1.06-1.06 3.5 3.5 0 0 0 0-4.95.75.75 0 0 1 0-1.06zm-4.95 0a.75.75 0 0 1 0 1.06 3.5 3.5 0 0 0 0 4.95.75.75 0 0 1-1.06 1.06 5 5 0 0 1 0-7.07.75.75 0 0 1 1.06 0zM11 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
  </Svg>
);
export default SvgSignal;
