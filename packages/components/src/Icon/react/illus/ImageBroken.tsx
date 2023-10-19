import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgImageBroken = (props: SvgProps) => (
  <Svg viewBox="0 0 20 18" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="M17.5 12.5H20v1.25a3.75 3.75 0 0 1-3.75 3.75H3.75A3.75 3.75 0 0 1 0 13.75h5.625c.331 0 .65-.133.884-.367l1.616-1.616 1.616 1.616a1.249 1.249 0 0 0 1.768 0l2.958-2.959 2.252 1.801c.221.178.497.274.78.274ZM20 3.75V10h-2.062l-2.782-2.226a1.248 1.248 0 0 0-1.665.092l-2.866 2.866L9.01 9.116a1.25 1.25 0 0 0-1.768 0L5.108 11.25H0v-7.5A3.75 3.75 0 0 1 3.75 0h12.5A3.75 3.75 0 0 1 20 3.75ZM7.5 5.625a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0Z"
      fill="#8C8CA1"
    />
  </Svg>
);
export default SvgImageBroken;
