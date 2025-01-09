import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgColorPicker = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M14.879 3.707 11.5 7.086l-.793-.793a1 1 0 0 0-1.414 1.414l.793.793-6.5 6.5A2 2 0 0 0 3 16.414V19a2 2 0 0 0 2 2h2.586A2 2 0 0 0 9 20.414l6.5-6.5.793.793a1 1 0 0 0 1.414-1.414l-.793-.793 3.379-3.379a3.001 3.001 0 0 0 0-4.243l-1.172-1.17a3 3 0 0 0-4.242-.001ZM11.5 9.914l2.586 2.586-2.5 2.5H6.414L11.5 9.914Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgColorPicker;
