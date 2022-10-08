import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgSortDescending = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0-4-4m4 4 4-4"
    />
  </Svg>
);

export default SvgSortDescending;
