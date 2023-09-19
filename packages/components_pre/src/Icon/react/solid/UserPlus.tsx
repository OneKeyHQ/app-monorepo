import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUserPlus = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6.25 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0zm-3 12.75a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122zM19.75 7.5a.75.75 0 0 0-1.5 0v2.25H16a.75.75 0 0 0 0 1.5h2.25v2.25a.75.75 0 0 0 1.5 0v-2.25H22a.75.75 0 0 0 0-1.5h-2.25V7.5z" />
  </Svg>
);
export default SvgUserPlus;
