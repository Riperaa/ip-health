export const INVALID_IP_ADDRESS_MESSAGE = "Invalid IP address";

export function isValidIpv4Address(value: string) {
  const parts = value.trim().split(".");

  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) {
      return false;
    }

    const octet = Number(part);

    return Number.isInteger(octet) && octet >= 0 && octet <= 255;
  });
}

export function assertValidIpv4Address(value: string) {
  if (!isValidIpv4Address(value)) {
    throw new Error(INVALID_IP_ADDRESS_MESSAGE);
  }
}
