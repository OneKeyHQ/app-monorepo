import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFaceHappy = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m4 12a38.7 38.7 0 0 1-8 0 4 4 0 0 0 8 0M9.74 7.593a1.56 1.56 0 0 0-1.219.53 1.56 1.56 0 0 0-1.325-.082c-.456.186-.8.588-.91 1.083-.227 1.02.527 2.282 2.825 3.048l.132.044.11-.086c1.897-1.506 2.175-2.95 1.613-3.831a1.53 1.53 0 0 0-1.227-.706Zm4.523 0a1.53 1.53 0 0 0-1.226.706c-.562.88-.285 2.325 1.612 3.83l.11.087.132-.044c2.298-.766 3.053-2.028 2.826-3.048a1.53 1.53 0 0 0-.911-1.082 1.56 1.56 0 0 0-1.326.081 1.56 1.56 0 0 0-1.217-.53"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFaceHappy;
