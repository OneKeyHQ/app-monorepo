import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderOpen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 5.056c0-1.095.888-1.983 1.983-1.983H9.4c.663 0 1.282.332 1.65.883l1.394 2.092h6.409c1.095 0 1.983.887 1.983 1.982v1.983h.317c1.003 0 1.719.973 1.42 1.93l-2.278 7.287a.99.99 0 0 1-.946.697H3.983A1.983 1.983 0 0 1 2 17.944zm4.818 12.888h11.803l1.858-5.948H8.677zm-2.835 0h.758l2.043-6.54a1.98 1.98 0 0 1 1.893-1.391h10.176V8.03h-6.94a.99.99 0 0 1-.824-.441L9.4 5.056H3.983z" />
  </Svg>
);
export default SvgFolderOpen;
