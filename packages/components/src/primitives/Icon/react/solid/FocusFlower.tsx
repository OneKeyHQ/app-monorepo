import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFocusFlower = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.67 3.855 18 2.523V8a6 6 0 0 1-5 5.917v1.69a6.12 6.12 0 0 1 5.093-1.534l.721.112.113.723A6.143 6.143 0 0 1 12 21.94a6.143 6.143 0 0 1-6.927-7.033l.113-.723.721-.112A6.12 6.12 0 0 1 11 15.607v-1.69A6 6 0 0 1 6 8V2.523l3.33 1.332L12 1.72zM7.003 16.003a4.143 4.143 0 0 0 3.994 3.995 4.143 4.143 0 0 0-3.994-3.995m9.994 0a4.143 4.143 0 0 0-3.994 3.995 4.143 4.143 0 0 0 3.994-3.995"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFocusFlower;
