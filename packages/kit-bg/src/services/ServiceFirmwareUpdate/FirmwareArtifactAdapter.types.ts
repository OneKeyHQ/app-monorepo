import type { ITrustedFirmwareArchiveEntry } from './trustedFirmwareCatalog';

export type IFirmwareArtifactRoute =
  | {
      routeType: 'domain';
    }
  | {
      routeType: 'pinnedIp';
      resolvedIp: string;
    };

export type IFirmwareArtifactReceipt = {
  artifactRef: string;
  size: number;
  sha256: string;
};

export type IFirmwareArtifactLeaseDisposition =
  | 'completed'
  | 'safeCancelled'
  | 'safeAbandoned';

export type IFirmwareMaterializedArtifact = {
  entryName: string;
  receipt: IFirmwareArtifactReceipt;
};

export type IFirmwareArtifactCapabilities = {
  firmwareArtifactProtocolVersion: number;
  supportedRouteTypes: string[];
  supportsArchiveMaterialization: boolean;
  maxReadBytes: number;
};

export interface IFirmwareArtifactAdapter {
  getCapabilities():
    | IFirmwareArtifactCapabilities
    | Promise<IFirmwareArtifactCapabilities>;
  download(input: {
    taskId: string;
    transactionId: string;
    leaseRef: string;
    artifactId: string;
    url: string;
    route: IFirmwareArtifactRoute;
    expectedSize: number;
    expectedSha256: string;
    maxBytes: number;
    overallDeadlineSeconds: number;
  }): Promise<IFirmwareArtifactReceipt>;
  cancelDownloads(transactionId: string): Promise<void>;
  materialize(input: {
    leaseRef: string;
    archiveArtifactRef: string;
    expectedEntries: readonly ITrustedFirmwareArchiveEntry[];
  }): Promise<readonly IFirmwareMaterializedArtifact[]>;
  open(artifactRef: string): Promise<{ readerId: string; size: number }>;
  read(input: {
    readerId: string;
    offset: number;
    length: number;
  }): Promise<ArrayBuffer>;
  close(readerId: string): Promise<void>;
  createLease(transactionId: string): Promise<{ leaseRef: string }>;
  retain(input: { leaseRef: string; artifactRef: string }): Promise<void>;
  releaseLease(input: {
    leaseRef: string;
    disposition: IFirmwareArtifactLeaseDisposition;
  }): Promise<void>;
  sweepOrphans(): Promise<{ deletedFiles: number; deletedBytes: number }>;
}
