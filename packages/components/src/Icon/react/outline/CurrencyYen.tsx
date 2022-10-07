import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgCurrencyYen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m9 8 3 5m0 0 3-5m-3 5v4m-3-5h6m-6 3h6m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
    />
  </Svg>
);

export default SvgCurrencyYen;
