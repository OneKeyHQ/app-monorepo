import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCheckboxChecked = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12.204 5.043a1 1 0 0 1 0 1.414l-4.5 4.5a1 1 0 0 1-1.414 0l-2-2a1 1 0 1 1 1.414-1.414l1.293 1.293 3.793-3.793a1 1 0 0 1 1.414 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCheckboxChecked;
