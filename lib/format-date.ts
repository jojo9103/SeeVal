const seoulDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatSeoulDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = Object.fromEntries(
    seoulDateTimeFormatter
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );

  return `${parts.year}. ${Number(parts.month)}. ${Number(parts.day)}. ${parts.hour}:${parts.minute}`;
}
