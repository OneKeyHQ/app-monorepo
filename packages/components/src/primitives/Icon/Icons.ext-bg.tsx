/* eslint-disable */

const icons = new Proxy({}, {
  get: function() {
    return () => null
  },
});
export type IKeyOfIcons = keyof typeof icons;
export default icons;
