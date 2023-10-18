import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgContrast = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 4a8 8 0 1 0 0 16V4ZM2 12C2 6.477 6.477 2 12 2c.375 0 .745.02 1.11.061C18.11 2.614 22 6.852 22 12s-3.89 9.386-8.89 9.939c-.365.04-.735.061-1.11.061-5.523 0-10-4.477-10-10Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgContrast;
