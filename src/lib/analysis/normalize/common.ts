export function parseOrg(org?: string) {
  if (!org) {
    return {};
  }

  const [asn, ...nameParts] = org.split(" ");

  return {
    asn,
    name: nameParts.join(" "),
  };
}

export function formatDetail(value?: string | null) {
  const trimmedValue = value?.trim();
  const normalizedValue = trimmedValue?.toLowerCase();

  if (
    !trimmedValue ||
    normalizedValue === "unknown" ||
    normalizedValue === "not identified"
  ) {
    return "Not identified";
  }

  return trimmedValue;
}

export function pickDetail(...values: (string | null | undefined)[]) {
  return values.find((value) => formatDetail(value) !== "Not identified");
}

export function hasDetail(value?: string | null) {
  return formatDetail(value) !== "Not identified";
}

export function isObjectRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}
