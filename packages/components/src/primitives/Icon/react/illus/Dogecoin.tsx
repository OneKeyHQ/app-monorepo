import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDogecoin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="#8C8CA1"
      fillRule="evenodd"
      d="M6.624 7.305h2.157v1.143H6.624v2.409h1.36q.809 0 1.322-.218.516-.22.808-.605a2.2 2.2 0 0 0 .398-.908A5.7 5.7 0 0 0 10.617 8a5.7 5.7 0 0 0-.105-1.126 2.2 2.2 0 0 0-.398-.907 1.94 1.94 0 0 0-.808-.605q-.514-.22-1.321-.219H6.624zM5.241 8.448H4.5V7.306h.741V4h3.274q.908 0 1.571.314.664.314 1.085.857t.625 1.271Q12 7.172 12 8a5.7 5.7 0 0 1-.205 1.557 3.7 3.7 0 0 1-.625 1.272q-.42.543-1.084.857T8.516 12H5.24z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDogecoin;
