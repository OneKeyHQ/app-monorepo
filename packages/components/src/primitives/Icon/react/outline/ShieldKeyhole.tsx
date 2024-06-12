import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShieldKeyhole = (props: SvgProps) => (
  <Svg viewBox="0 0 32 32" accessibilityRole="image" {...props}>
    <Path
      d="M16 10.667a3.333 3.333 0 0 0-1.333 6.39V20a1.333 1.333 0 1 0 2.666 0v-2.945A3.334 3.334 0 0 0 16 10.668Z"
      fill="currentColor"
      fillOpacity={0.608}
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M17.3 3.038a4 4 0 0 0-2.6 0l-8 2.75A4 4 0 0 0 4 9.57v6.314c0 3.742 1.532 6.439 3.75 8.539 2.097 1.985 4.843 3.466 7.408 4.849l.209.113c.395.213.87.213 1.266 0l.21-.113c2.564-1.383 5.31-2.864 7.407-4.85 2.218-2.1 3.75-4.796 3.75-8.538V9.57a4 4 0 0 0-2.7-3.782l-8-2.75Zm-1.733 2.521c.28-.096.585-.096.866 0l8 2.75c.539.185.9.692.9 1.261v6.314c0 2.887-1.134 4.915-2.916 6.602-1.702 1.611-3.953 2.877-6.417 4.21-2.464-1.333-4.715-2.599-6.417-4.21-1.782-1.687-2.916-3.715-2.916-6.602V9.57c0-.569.361-1.076.9-1.26l8-2.75Z"
      fill="currentColor"
      fillOpacity={0.608}
    />
  </Svg>
);
export default SvgShieldKeyhole;
