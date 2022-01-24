export type UserType = {
  id: number;
  email: string;
  name: string;
};

export type TicketType = {
  id: number;
  createdAt?: string;
  updatedAt?: string;
  description?: string;
  requesterId?: number;
  submitterId: number;
};

export type AttachmentsType = {
  id: number;
  url?: number;
  fileName?: string;
  contentType?: string;
  size?: number;
  submitterId?: number;
  thumbnails: string;
};

export type CommentType = {
  id: number;
  authorId?: number;
  updatedAt?: string;
  body?: string;
  attachments?: AttachmentsType[];
};
