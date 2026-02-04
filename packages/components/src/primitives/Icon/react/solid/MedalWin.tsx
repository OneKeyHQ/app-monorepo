import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMedalWin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4.056 8.944a7.944 7.944 0 1 1 12.909 6.201v6.151a1.49 1.49 0 0 1-2.156 1.332L12 21.224l-2.808 1.404a1.49 1.49 0 0 1-2.156-1.332v-6.15a7.93 7.93 0 0 1-2.979-6.202Zm4.965 7.366v4.183l2.313-1.157c.42-.21.913-.21 1.332 0l2.313 1.157V16.31a7.9 7.9 0 0 1-2.98.578 7.9 7.9 0 0 1-2.978-.578"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMedalWin;
