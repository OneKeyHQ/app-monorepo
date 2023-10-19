import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFileText = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M13 3.5V7a2 2 0 0 0 2 2h3.5M9 13h3m-3 4h6.5M7 3h5.172a2 2 0 0 1 1.414.586l4.828 4.828A2 2 0 0 1 19 9.828V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
    />
  </Svg>
);
export default SvgFileText;
