import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUserCircle = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-6-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-2 4a5 5 0 0 0-4.546 2.916A5.986 5.986 0 0 0 10 16a5.986 5.986 0 0 0 4.546-2.084A5 5 0 0 0 10 11z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgUserCircle;
