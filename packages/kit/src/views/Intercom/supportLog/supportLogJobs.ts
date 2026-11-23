import { useSyncExternalStore } from 'react';

import {
  collectLogDigest,
  disposeLogDigest,
} from '@onekeyhq/kit/src/views/Setting/pages/Tab/exportLogs';
import {
  isLogUploadRateLimitError,
  uploadLogsWithRetry,
} from '@onekeyhq/kit/src/views/Setting/pages/Tab/exportLogs/uploadLogsWithRetry';
import { buildDefaultFileBaseName } from '@onekeyhq/kit/src/views/Setting/pages/Tab/exportLogs/utils';
import type { ILogDigest } from '@onekeyhq/shared/src/logger/types';
import { intercomMessageBlocks } from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerModels';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { createIntercomMessengerSession } from '../client';

export type ISupportLogStage =
  | 'preparing'
  | 'uploading'
  | 'processing'
  // Uploaded; waits for the first message to create the conversation.
  | 'ready'
  | 'sending'
  | 'sent'
  | 'uploadFailed'
  | 'sendFailed'
  | 'rateLimited';

export type ISupportLogJob = {
  id: string;
  stage: ISupportLogStage;
  conversationId?: string;
  // Present only while bytes are known to be moving; some routes report
  // nothing until the response.
  progressPercent?: number;
  sizeBytes?: number;
};

type ISupportLogRecord = ISupportLogJob & {
  ownerUserId: string | null;
  // First line of the log ID message, in the language chosen at consent.
  messageTitle: string;
  objectKey?: string;
  // Reused on every send so a retry cannot post the log ID twice.
  messageClientId: string;
  run: number;
};

const jobs = new Map<string, ISupportLogRecord>();
const listeners = new Set<() => void>();

function update(id: string, patch: Partial<ISupportLogRecord>) {
  const job = jobs.get(id);
  if (!job) return;
  jobs.set(id, { ...job, ...patch });
  listeners.forEach((listener) => listener());
}

async function sendLogId(id: string) {
  const job = jobs.get(id);
  if (
    !job?.objectKey ||
    !job.conversationId ||
    (job.stage !== 'ready' && job.stage !== 'sendFailed')
  )
    return;
  const { objectKey, conversationId, ownerUserId, messageClientId } = job;
  update(id, { stage: 'sending' });
  try {
    const session = await createIntercomMessengerSession(ownerUserId);
    // Never replay the write blindly: an earlier attempt may have landed.
    const conversation = await session.getConversation(conversationId);
    if (!conversation.parts.some((part) => part.clientId === messageClientId)) {
      await session.reply(conversationId, {
        clientId: messageClientId,
        createdAt: Math.floor(Date.now() / 1000),
        // `Log ID:` stays untranslated so support can search for it.
        blocks: intercomMessageBlocks(
          `${job.messageTitle}\nLog ID: ${objectKey}`,
        ),
      });
    }
    update(id, { stage: 'sent' });
  } catch {
    update(id, { stage: 'sendFailed' });
  }
}

async function uploadLogs(id: string) {
  const job = jobs.get(id);
  if (!job) return;
  const run = job.run + 1;
  update(id, {
    run,
    stage: 'preparing',
    progressPercent: undefined,
    sizeBytes: undefined,
  });
  // A cancelled or restarted job ignores whatever this run reports later.
  const isCurrent = () => jobs.get(id)?.run === run;
  const upload: { digest?: ILogDigest } = {};
  try {
    const objectKey = await uploadLogsWithRetry({
      state: upload,
      collectDigest: async () => {
        // Native and desktop always collect everything they keep; the
        // browser store keeps up to BROWSER_LOG_MAX_BYTES.
        const digest = await collectLogDigest(
          buildDefaultFileBaseName(),
          'full',
        );
        if (isCurrent()) {
          update(id, { stage: 'uploading', sizeBytes: digest.sizeBytes });
        }
        return digest;
      },
      onProgress: (progressPercent) => {
        if (!isCurrent() || !progressPercent) return;
        // All bytes are out; the server still stores the file before replying.
        update(
          id,
          progressPercent >= 100
            ? { stage: 'processing', progressPercent: undefined }
            : { stage: 'uploading', progressPercent },
        );
      },
    });
    if (!isCurrent()) return;
    update(id, { stage: 'ready', objectKey, progressPercent: undefined });
    await sendLogId(id);
  } catch (error) {
    if (isCurrent()) {
      update(id, {
        stage: isLogUploadRateLimitError(error)
          ? 'rateLimited'
          : 'uploadFailed',
        progressPercent: undefined,
      });
    }
  } finally {
    if (upload.digest) {
      await disposeLogDigest(upload.digest).catch(() => undefined);
    }
  }
}

// Jobs live only for this app session; after a restart the user sends the
// logs again from the conversation.
export function startSupportLogUpload({
  ownerUserId,
  conversationId,
  messageTitle,
}: {
  ownerUserId: string | null;
  conversationId?: string;
  messageTitle: string;
}) {
  // A conversation shows one upload; starting another replaces it.
  for (const [key, job] of jobs) {
    if (conversationId && job.conversationId === conversationId) {
      jobs.delete(key);
    }
  }
  const id = generateUUID();
  jobs.set(id, {
    id,
    ownerUserId,
    conversationId,
    messageTitle,
    stage: 'preparing',
    messageClientId: generateUUID(),
    run: 0,
  });
  void uploadLogs(id);
  return id;
}

// The first message creates the conversation; the log ID follows it there.
export function bindSupportLogConversation(id: string, conversationId: string) {
  const job = jobs.get(id);
  if (!job || job.conversationId) return;
  update(id, { conversationId });
  void sendLogId(id);
}

export function retrySupportLog(id: string) {
  const stage = jobs.get(id)?.stage;
  if (stage === 'sendFailed') void sendLogId(id);
  if (stage === 'uploadFailed' || stage === 'rateLimited') void uploadLogs(id);
}

// Cancels, dismisses or clears a job. An upload already in flight finishes
// on its own, but its log ID is never sent.
export function removeSupportLog(id: string) {
  if (jobs.delete(id)) listeners.forEach((listener) => listener());
}

export function isSupportLogActive(job: ISupportLogJob | undefined) {
  return (
    !!job &&
    ['preparing', 'uploading', 'processing', 'ready', 'sending'].includes(
      job.stage,
    )
  );
}

export const getSupportLogJob = (id: string): ISupportLogJob | undefined =>
  jobs.get(id);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function findJob(jobId?: string, conversationId?: string) {
  const pending = jobId ? jobs.get(jobId) : undefined;
  if (pending || !conversationId) return pending;
  // Map order is insertion order, so the last match is the newest job.
  let latest: ISupportLogRecord | undefined;
  for (const job of jobs.values()) {
    if (job.conversationId === conversationId) latest = job;
  }
  return latest;
}

export function useSupportLogJob({
  jobId,
  conversationId,
}: {
  jobId?: string;
  conversationId?: string;
}): ISupportLogJob | undefined {
  return useSyncExternalStore(subscribe, () => findJob(jobId, conversationId));
}
