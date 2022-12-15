import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBan = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13.477 14.89A6 6 0 0 1 5.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 0 1 8.367 8.367zM18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBan;
