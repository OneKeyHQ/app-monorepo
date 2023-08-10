import Svg, { SvgProps, G, Rect, Path, Defs, ClipPath } from 'react-native-svg';
const SvgMonero = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <G clipPath="url(#a)">
      <Rect width={16} height={16} rx={8} fill="#303040" />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.04 7.269 8.076 1 4 7.269l4.077-1.69 3.962 1.69ZM4.16 8.996l3.963 6.137L12.2 8.996l-4.077 2.44-3.962-2.44Z"
        fill="#E2E2E8"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.2 8.19 8.077 6.471 4 8.189l4.077 2.442L12.2 8.189Z"
        fill="#E2E2E8"
      />
      <G clipPath="url(#b)">
        <Path
          d="M0 8a8 8 0 0 0 8 7.998A8 8 0 1 0 8 0a8 8 0 0 0-8 8Z"
          fill="#E2E2E8"
        />
        <Path
          d="M8 0C12.417 0 16.005 3.587 16 7.999a8.02 8.02 0 0 1-.406 2.526h-2.394V3.796L8 8.995 2.801 3.796v6.73H.407a8.022 8.022 0 0 1-.406-2.527C-.007 3.582 3.583.001 8 .001V0Z"
          fill="#303040"
        />
        <Path
          d="m9.196 10.19 2.269-2.27v4.235h3.371a8 8 0 0 1-13.673 0h3.373V7.921l2.269 2.269L8 11.385l1.196-1.195Z"
          fill="#303040"
        />
      </G>
    </G>
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} stroke="#1E1E2A" />
    <Defs>
      <ClipPath id="a">
        <Rect width={16} height={16} rx={8} fill="#fff" />
      </ClipPath>
      <ClipPath id="b">
        <Path fill="#fff" transform="matrix(-1 0 0 1 16 0)" d="M0 0h16v16H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgMonero;
