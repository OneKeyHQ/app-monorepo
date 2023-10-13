import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFire = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11.52 1.623a1 1 0 0 1 .96 0l.002.001.003.001.006.004.022.012.073.042a17.24 17.24 0 0 1 1.164.756c.74.524 1.727 1.302 2.717 2.32 1.968 2.024 4.033 5.09 4.033 9.053 0 2.682-1.061 4.759-2.695 6.15C16.192 21.338 14.077 22 12 22c-2.077 0-4.192-.66-5.805-2.034-1.634-1.392-2.695-3.47-2.695-6.154 0-3.964 2.065-7.029 4.033-9.053a19.775 19.775 0 0 1 2.717-2.32 17.24 17.24 0 0 1 1.164-.756 6.58 6.58 0 0 1 .073-.042l.022-.012.006-.004h.002l.002-.002Zm.333 10.487a.241.241 0 0 1 .294 0c.314.24.69.56 1.064.95.938.98 1.789 2.328 1.789 3.989 0 1.064-.4 1.773-.921 2.225-.543.47-1.294.726-2.08.726-.785 0-1.536-.255-2.078-.724C9.4 18.824 9 18.114 9 17.049c0-1.661.85-3.009 1.789-3.989.374-.39.75-.71 1.064-.95Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFire;
