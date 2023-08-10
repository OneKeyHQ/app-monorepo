import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPlayCircle = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0zm6.39-2.908a.75.75 0 0 1 .766.027l3.5 2.25a.75.75 0 0 1 0 1.262l-3.5 2.25A.75.75 0 0 1 8 12.25v-4.5a.75.75 0 0 1 .39-.658z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPlayCircle;
