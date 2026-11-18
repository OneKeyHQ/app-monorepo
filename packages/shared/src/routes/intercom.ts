export type IIntercomSupportRoute = {
  userId: string | null;
  requestId?: string;
  conversationId?: string;
};

export enum EIntercomRoutes {
  Home = 'IntercomHome',
  Messages = 'IntercomMessages',
  Conversation = 'IntercomConversation',
  Help = 'IntercomHelp',
}

export type IIntercomParamList = {
  [EIntercomRoutes.Home]: IIntercomSupportRoute;
  [EIntercomRoutes.Messages]: IIntercomSupportRoute;
  [EIntercomRoutes.Conversation]: IIntercomSupportRoute;
  [EIntercomRoutes.Help]: IIntercomSupportRoute;
};
