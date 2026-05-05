import { EPerpPageEnterSource } from './type';

export { EPerpPageEnterSource };

let _pendingSource: EPerpPageEnterSource | null = null;

export function setPerpPageEnterSource(source: EPerpPageEnterSource) {
  _pendingSource = source;
}

export function consumePerpPageEnterSource(): EPerpPageEnterSource {
  const source = _pendingSource ?? EPerpPageEnterSource.DirectUrl;
  _pendingSource = null;
  return source;
}
