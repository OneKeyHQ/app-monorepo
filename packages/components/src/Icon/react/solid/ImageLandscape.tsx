import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgImageLandscape = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 4a3 3 0 0 0-3 3v5.874l.485-.256c.994-.524 2.364-1.247 3.77-1.893.973-.448 1.994-.873 2.963-1.188C10.173 9.227 11.145 9 12 9s1.827.226 2.782.537c.969.315 1.99.74 2.963 1.188 1.406.646 2.776 1.37 3.77 1.893l.485.256V7a3 3 0 0 0-3-3H5Z"
    />
    <Path
      fill="currentColor"
      d="m22 15.121-.453-.23a79.484 79.484 0 0 1-1.027-.535c-.985-.52-2.259-1.192-3.61-1.814-.936-.43-1.88-.821-2.747-1.103-.65-.212-1.22-.35-1.694-.408l-.032.044a9.866 9.866 0 0 0-.68 1.083c-.227.426-.395.84-.462 1.193-.067.351-.013.517.034.59.013.012.118.094.527.124.393.029.845-.002 1.387-.04l.365-.024c.636-.04 1.424-.078 2.105.09.356.087.737.242 1.067.525.341.294.575.682.69 1.142.254 1.014-.212 1.858-.805 2.454-.581.585-1.4 1.062-2.242 1.455-.273.127-.47.239-.613.333H19a3 3 0 0 0 3-3v-1.879Z"
    />
    <Path
      fill="currentColor"
      d="M11.477 20a2.18 2.18 0 0 1 .587-1.138c.342-.365.836-.692 1.514-1.008.767-.358 1.335-.716 1.669-1.052.322-.324.302-.485.283-.56-.02-.08-.044-.1-.054-.11a.59.59 0 0 0-.24-.1c-.34-.083-.83-.078-1.5-.035l-.306.02c-.541.039-1.17.083-1.72.043-.632-.047-1.52-.223-2.042-1.005-.453-.679-.457-1.451-.338-2.078.105-.55.322-1.087.556-1.554l-.05.016c-.867.282-1.81.673-2.746 1.103-1.351.622-2.625 1.293-3.61 1.814-.393.207-.74.39-1.027.536l-.453.23V17a3 3 0 0 0 3 3h6.477Z"
    />
  </Svg>
);
export default SvgImageLandscape;
