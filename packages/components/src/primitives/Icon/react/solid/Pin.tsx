import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 10a8 8 0 1 1 16 0c0 2.474-1.094 4.759-2.37 6.594-1.282 1.846-2.814 3.332-3.838 4.23a2.702 2.702 0 0 1-3.584 0c-1.024-.898-2.556-2.384-3.839-4.23C5.094 14.76 4 12.474 4 10Zm7.998 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPin;
