import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCurrencyPound = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.121 7.629A3 3 0 0 0 9.017 9.43a2.56 2.56 0 0 0 .028.636l.506 3.541a4.5 4.5 0 0 1-.43 2.65L9 16.5l1.539-.513a2.25 2.25 0 0 1 1.422 0l.655.218a2.25 2.25 0 0 0 1.718-.122L15 15.75M8.25 12H12m9 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
    />
  </Svg>
);
export default SvgCurrencyPound;
