import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMultiMedia = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 10v10h10V10zm3.541 2.512a1 1 0 0 1 1.038.073l2.25 1.6a1 1 0 0 1 0 1.63l-2.25 1.6A1 1 0 0 1 13 16.6v-3.2a1 1 0 0 1 .541-.888M6.25 5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5M8 14v-1.47l-.055-.031L6 11.201 4.055 12.5q-.027.016-.055.031V14zM4 4v6.13l1.445-.962.13-.073a1 1 0 0 1 .98.073L8 10.131V10a2 2 0 0 1 2-2h4V4zm12 4h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-4H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgMultiMedia;
