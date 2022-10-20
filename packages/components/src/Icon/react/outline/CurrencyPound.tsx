import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCurrencyPound = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 9a2 2 0 1 0-4 0v5a2 2 0 0 1-2 2h6m-6-4h4m8 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
    />
  </Svg>
);
export default SvgCurrencyPound;
