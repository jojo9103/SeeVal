export type WorkspaceActionState = {
  type: "idle" | "success" | "error";
  message: string;
};

export type WorkspaceUser = {
  id?: string;
  name: string;
  email: string;
  organization: string;
};

export type ShareUser = {
  id: string;
  name: string;
  email: string;
  organization: string;
};

export type ProjectFile = {
  id: string;
  fileName: string;
  kind: string;
  size: number;
};

export type OutgoingShareStatus = {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  project: {
    id: string;
    name: string;
  };
  sharedWith: {
    name: string;
    email: string;
    organization: string;
  };
};

export type Project = {
  id: string;
  name: string;
  ownerName: string;
  ownedByMe: boolean;
  canReview: boolean;
  canDelete: boolean;
  createdAt: string;
  files: ProjectFile[];
  pendingShareCount: number;
  shareStatuses: OutgoingShareStatus[];
};

export type ShareRequest = {
  id: string;
  message: string | null;
  createdAt: string;
  project: {
    id: string;
    name: string;
    ownerName: string;
  };
};

export type AdminNotice = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  authorName: string;
};

export type WorkspaceFormAction = (
  state: WorkspaceActionState,
  formData: FormData
) => Promise<WorkspaceActionState>;

export type ShareResponseAction = (formData: FormData) => void | Promise<void>;

export const initialState: WorkspaceActionState = {
  type: "idle",
  message: "",
};

export type UploadPhase = "idle" | "uploading" | "processing";

export type UploadStatus = {
  phase: UploadPhase;
  percent: number;
  loaded: number;
  total: number;
  elapsedMs: number;
  bytesPerSecond: number;
};

export const initialUploadStatus: UploadStatus = {
  phase: "idle",
  percent: 0,
  loaded: 0,
  total: 0,
  elapsedMs: 0,
  bytesPerSecond: 0,
};
