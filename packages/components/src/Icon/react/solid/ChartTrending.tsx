import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartTrending = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12.864 5.004 9.88 14.609c-.578 1.86-3.194 1.885-3.807.036l-1.18-3.56-.97 2.312a1 1 0 1 1-1.844-.772l.97-2.315c.715-1.71 3.159-1.613 3.741.143l1.18 3.56 2.986-9.604c.606-1.952 3.392-1.848 3.856.138l3.381 14.449 1.865-5.31a1 1 0 1 1 1.887.662L20.08 19.66c-.664 1.893-3.378 1.741-3.834-.207l-3.38-14.449Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartTrending;
