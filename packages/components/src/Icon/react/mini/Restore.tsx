import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRestore = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3.213 7.17a.75.75 0 0 0 .75.75h4.242a.75.75 0 1 0 0-1.5H5.773l.311-.31A5.471 5.471 0 0 1 8.55 4.687a5.508 5.508 0 0 1 1.71-.181 5.502 5.502 0 0 1 5.026 4.07.754.754 0 0 0 .072.176 5.5 5.5 0 1 1-10.84 1.69.75.75 0 1 0-1.496.117 7 7 0 1 0 7.395-7.547c-.74-.047-1.5.024-2.255.227-1.23.33-2.298.969-3.14 1.811l-.31.31.001-2.43a.75.75 0 0 0-1.5-.001V7.17Z" />
  </Svg>
);
export default SvgRestore;
