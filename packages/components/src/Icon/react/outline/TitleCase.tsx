import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTitleCase = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2.325 18.425c.693 0 1.083-.347 1.326-1.178l.658-1.95h4.513l.658 1.976c.234.814.623 1.152 1.36 1.152.762 0 1.308-.511 1.308-1.23 0-.26-.044-.494-.165-.832L8.553 7.06c-.372-1.022-.979-1.472-2-1.472-.988 0-1.603.468-1.967 1.481l-3.413 9.294c-.112.32-.173.615-.173.832 0 .753.511 1.23 1.325 1.23ZM4.88 13.27 6.5 8.15h.06l1.655 5.12H4.88Zm11.784 5.137c1.161 0 2.322-.58 2.841-1.567h.052v.476c.052.745.529 1.126 1.213 1.126.719 0 1.23-.433 1.23-1.273v-5.293c0-1.87-1.55-3.1-3.933-3.1-1.922 0-3.412.684-3.845 1.792a1.34 1.34 0 0 0-.13.572c0 .572.441.97 1.056.97.408 0 .728-.156 1.005-.467.563-.728 1.031-.98 1.802-.98.953 0 1.56.503 1.56 1.37v.614l-2.34.139c-2.321.138-3.62 1.117-3.62 2.806 0 1.672 1.342 2.815 3.11 2.815Zm.832-1.827c-.849 0-1.42-.433-1.42-1.126 0-.659.536-1.083 1.48-1.152l1.958-.122v.676c0 1.005-.91 1.724-2.018 1.724Z"
    />
  </Svg>
);
export default SvgTitleCase;
