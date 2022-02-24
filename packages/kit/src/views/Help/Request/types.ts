export type RequestPayload<T> = {
  success: boolean;
  status: number;
  data: T;
};

export type UploadAttachmentsPayload = {
  upload: {
    token: string;
    attachment: AttachmentsType;
  };
};

export type ImageModel = {
  'loading': boolean;
  'localPath': string;
  'token'?: string;
  'filename': string;
};

export type AttachmentsType = {
  'id': number;
  'url': string;
  'file_name': string;
  'content_url': string;
  'size': number;
  'submitter_id': number;
  'thumbnails': AttachmentsType;
};

export type TicketType = {
  'id': number;
  'description': string;
  'submitter_id': number;
  'created_at': string;
  'custom_fields': { 'id': number; 'value': string }[];
};

export type CommentType = {
  'id': number;
  'author_id': number;
  'created_at': string;
  'body': string;
  'attachments': AttachmentsType[];
};
