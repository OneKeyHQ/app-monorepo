const endpointsMap: Record<
  'test' | 'prod',
  { http: string; websocket: string }
> = {
  test: {
    http: 'http://18.138.227.191:9008',
    websocket: '',
  },
  prod: {
    // TODO: change to prod endpoint
    http: 'http://18.138.227.191:9008',
    websocket: '',
  },
};

export { endpointsMap };
