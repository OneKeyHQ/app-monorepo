import axios from 'axios';

import { RequestPayload, UploadAttachmentsPayload } from './types';

const host = 'https://e8d8-140-240-35-242.ngrok.io';

export const listUri = (instanceId: string) =>
  `${host}/api/tickets?instanceId=${instanceId}`;

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
