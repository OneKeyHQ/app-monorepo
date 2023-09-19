import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNoSymbol = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m5.965 4.904 9.131 9.131a6.5 6.5 0 0 0-9.131-9.131zm8.07 10.192L4.904 5.965a6.5 6.5 0 0 0 9.131 9.131zM4.343 4.343a8 8 0 1 1 11.314 11.314A8 8 0 0 1 4.343 4.343z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNoSymbol;
