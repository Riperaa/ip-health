import type { ServiceCompatibilityStatus } from "@/lib/analysis/types";

import { isObjectRecord } from "./common";

export type SafeServiceCompatibilitySource = {
  category: string;
  services: {
    name: string;
    status: ServiceCompatibilityStatus;
  }[];
};

const SERVICE_COMPATIBILITY_STATUSES = [
  "Good",
  "Use with Caution",
  "High Risk",
] as const;

function isServiceCompatibilityStatus(
  value: unknown,
): value is ServiceCompatibilityStatus {
  return SERVICE_COMPATIBILITY_STATUSES.some((status) => status === value);
}

function isServiceCompatibilityItem(
  value: unknown,
): value is { name?: unknown; status: ServiceCompatibilityStatus } {
  return isObjectRecord(value) && isServiceCompatibilityStatus(value.status);
}

export function normalizeServiceCompatibility(
  serviceCompatibility: unknown,
): SafeServiceCompatibilitySource[] {
  if (!Array.isArray(serviceCompatibility)) {
    return [];
  }

  return serviceCompatibility.filter(isObjectRecord).map((category) => {
    const services = Array.isArray(category.services)
      ? category.services.filter(isServiceCompatibilityItem).map((service) => ({
          name:
            typeof service.name === "string" && service.name.trim()
              ? service.name
              : "Unknown service",
          status: service.status,
        }))
      : [];

    return {
      category:
        typeof category.category === "string" && category.category.trim()
          ? category.category
          : "UNCATEGORIZED",
      services,
    };
  });
}
