import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAutoPageSize = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H7ZM6 5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4v-6a3 3 0 0 0-3-3H6V5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAutoPageSize;
