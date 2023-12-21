import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShip = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 12V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4M3 20l3.419-.76m0 0 .647-.144a2 2 0 0 1 .868 0l3.632.808a2 2 0 0 0 .868 0l3.632-.808a2 2 0 0 1 .868 0l.647.144m-11.162 0c-1.15-1.576-1.759-2.932-2.119-4.494-.227-.986.438-1.93 1.42-2.176l5.795-1.449c.318-.08.652-.08.97 0l5.796 1.45c.981.245 1.646 1.19 1.419 2.175-.36 1.562-.97 2.917-2.119 4.494m0 0L21 20M10 7V3h4v4"
    />
  </Svg>
);
export default SvgShip;
