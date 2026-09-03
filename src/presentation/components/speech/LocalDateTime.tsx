"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
const serverDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function LocalDateTime({ value }: { readonly value: string }) {
  const isHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const date = new Date(value);

  return (
    <time dateTime={value}>
      {isHydrated
        ? dateFormatter.format(date)
        : serverDateFormatter.format(date)}
    </time>
  );
}
