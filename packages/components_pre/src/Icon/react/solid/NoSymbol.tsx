import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNoSymbol = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m6.72 5.66 11.62 11.62A8.25 8.25 0 0 0 6.72 5.66zm10.56 12.68L5.66 6.72a8.25 8.25 0 0 0 11.62 11.62zM5.105 5.106c3.807-3.808 9.98-3.808 13.788 0 3.808 3.807 3.808 9.98 0 13.788-3.807 3.808-9.98 3.808-13.788 0-3.808-3.807-3.808-9.98 0-13.788z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNoSymbol;
