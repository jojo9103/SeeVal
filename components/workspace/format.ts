export function formatDate(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${year}. ${month}. ${day}. ${hours}:${minutes}`;
}

export function formatBytes(bytes: number) {
  if (!bytes) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function shareStatusLabel(status: string) {
  if (status === "PENDING") {
    return "승인 대기";
  }

  if (status === "ACCEPTED") {
    return "공유 완료";
  }

  if (status === "REJECTED") {
    return "거절됨";
  }

  return status;
}

export function shareStatusClassName(status: string) {
  if (status === "PENDING") {
    return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  }

  if (status === "ACCEPTED") {
    return "border-teal-300/25 bg-teal-300/10 text-teal-100";
  }

  if (status === "REJECTED") {
    return "border-rose-300/25 bg-rose-300/10 text-rose-100";
  }

  return "border-white/12 bg-white/[0.05] text-white/60";
}
