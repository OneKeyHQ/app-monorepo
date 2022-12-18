import axios from 'axios';

import type { RequestPayload, UploadAttachmentsPayload } from './types';

const host = 'https://ticket.onekey.so';

export const listUri = (instanceId: string, updatedAt?: string) =>
  `${host}/api/tickets?instanceId=${instanceId}&updatedAt=${updatedAt ?? ''}`;

export const ticketDetailUri = (id: number, instanceId: string) =>
  `${host}/api/ticket/${id}?instanceId=${instanceId}`;

export const commentsUri = (id: number, instanceId: string) =>
  `${host}/api/ticket/${id}/comments?instanceId=${instanceId}`;

export const uploadUri = (instanceId: string) =>
  `${host}/api/attachments?instanceId=${instanceId}`;

export const submitUri = (instanceId: string) =>
  `${host}/api/ticket?instanceId=${instanceId}`;

export const updateTicketUri = (id: number, instanceId: string) =>
  `${host}/api/ticket/${id}?instanceId=${instanceId}`;

export const attachmentUri = (attachmentId: number, instanceId: string) =>
  `${host}/api/attachments/${attachmentId}?instanceId=${instanceId}`;

type RequestCallback<T> = (
  error: Error | null,
  responseJson: any | unknown | RequestPayload<T>,
) => void;

export const uploadImage = (
  param: { filename: string; image: string },
  instanceId: string,
  callBack: RequestCallback<UploadAttachmentsPayload>,
) => {
  axios
    .post(uploadUri(instanceId), param)
    .then((response) => {
      if (callBack) {
        callBack(null, response.data);
      }
    })
    .catch((error) => {
      if (callBack) {
        callBack(error, null);
      }
    });
};

export const requestTicketDetail = (
  id: number,
  instanceId: string,
  callBack?: RequestCallback<UploadAttachmentsPayload>,
) => {
  axios
    .get(ticketDetailUri(id, instanceId))
    .then((response) => {
      if (callBack) {
        callBack(null, response.data);
      }
    })
    .catch((error) => {
      if (callBack) {
        callBack(error, null);
      }
    });
};

export const requestAttachmentUri = async (
  attachmentId: number,
  instanceId: string,
) => axios.get<RequestPayload<string>>(attachmentUri(attachmentId, instanceId));
