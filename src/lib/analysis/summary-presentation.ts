export type SummaryFragment = {
  text: string;
  source?: "ipqs-unavailable" | "connectivity-status";
  hasDefinitiveConnectivity?: boolean;
};

export function filterPublicSummaryFragments(
  fragments: readonly SummaryFragment[],
) {
  return fragments.filter((fragment) => {
    if (!fragment.text.trim() || fragment.source === "ipqs-unavailable") {
      return false;
    }

    if (fragment.source === "connectivity-status") {
      return fragment.hasDefinitiveConnectivity === true;
    }

    return true;
  });
}

export function joinEnglishSummaryFragments(
  fragments: readonly SummaryFragment[],
) {
  return filterPublicSummaryFragments(fragments)
    .map(({ text }) => text.trim().replace(/[.;；。]+$/, ""))
    .filter(Boolean)
    .map((text) => `${text}.`)
    .join(" ");
}
