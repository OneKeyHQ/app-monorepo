import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCurrencyYen = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM7.346 5.294a.75.75 0 0 0-1.192.912L9.056 10H6.75a.75.75 0 0 0 0 1.5h2.5v1h-2.5a.75.75 0 0 0 0 1.5h2.5v1.25a.75.75 0 0 0 1.5 0V14h2.5a.75.75 0 1 0 0-1.5h-2.5v-1h2.5a.75.75 0 1 0 0-1.5h-2.306l2.902-3.794a.75.75 0 1 0-1.192-.912L10 8.765l-2.654-3.47z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCurrencyYen;
