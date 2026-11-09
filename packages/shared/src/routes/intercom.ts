import type { IIntercomSupportRoute } from '../modules3rdParty/intercom/messengerTypes';

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
