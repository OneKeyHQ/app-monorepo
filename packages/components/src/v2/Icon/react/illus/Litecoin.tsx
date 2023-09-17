import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLitecoin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="#8C8CA1"
      d="m8.136 8.271-.833 2.809h4.455a.225.225 0 0 1 .232.217v.073l-.387 1.337a.288.288 0 0 1-.29.213H4.493l1.143-3.893-1.279.387.291-.891 1.278-.387 1.608-5.463a.292.292 0 0 1 .29-.213H9.55a.225.225 0 0 1 .232.217v.074L8.426 7.36l1.279-.388-.272.93-1.297.368Z"
    />
  </Svg>
);
export default SvgLitecoin;
