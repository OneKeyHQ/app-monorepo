import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartTrending = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.954 4.41c.607-1.952 3.393-1.85 3.858.137l3.38 14.448 1.865-5.31a1 1 0 1 1 1.886.663L20.08 19.66c-.664 1.893-3.378 1.74-3.834-.208L12.863 5.004 9.88 14.61c-.578 1.859-3.195 1.884-3.808.035l-1.18-3.562-.968 2.315a1.001 1.001 0 0 1-1.846-.773l.97-2.315c.716-1.709 3.16-1.613 3.742.143l1.18 3.56z" />
  </Svg>
);
export default SvgChartTrending;
