import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUserGroup = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm5 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-4 7a4 4 0 0 0-8 0v3h8v-3zM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm10 10v-3a5.972 5.972 0 0 0-.75-2.906A3.005 3.005 0 0 1 19 15v3h-3zM4.75 12.094A5.973 5.973 0 0 0 4 15v3H1v-3a3 3 0 0 1 3.75-2.906z" />
  </Svg>
);
export default SvgUserGroup;
