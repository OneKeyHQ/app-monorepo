export enum DemoRootRoutes {
  Main = 'main',

  Modal = 'modal',
}

export enum DemoMainRoutes {
  Tab = 'tab',
}

export enum DemoTabRoutes {
  Home = 'home',
  Developer = 'developer',
}

export enum DemoTabChildRoutes {
  // Home
  DemoRootHomeSearch = 'DemoRootHomeSearch',
  DemoRootHomeOptions = 'DemoRootHomeOptions',

  // Developer
  DemoDeveloperStep1 = 'DemoDeveloperStep1',
}

export enum DemoModalRoutes {
  DemoCreateModal = 'DemoCreateModal',
  DemoDoneModal = 'DemoDoneModal',
}

export enum DemoCreateModalRoutes {
  DemoCreateModal = 'DemoCreateModal',
  DemoCreateSearchModal = 'DemoCreateSearchModal',
  DemoCreateOptionsModal = 'DemoCreateOptionsModal',
}

export enum DemoDoneModalRoutes {
  DemoDoneModal = 'DemoDoneModal',
  DemoDone1Modal = 'DemoDone1Modal',
}
