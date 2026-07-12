import Link from "next/link";

import { FooterLinks } from "@/components/footer-links";
import { IpCompare } from "@/components/ip-compare";

export default function ComparePage() {
  return (
    <main className="flex min-h-dvh flex-col bg-[#f7f8fb] text-neutral-950">
      <Link
        href="/"
        className="fixed left-4 top-4 z-10 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 sm:left-8 sm:top-7"
      >
        IP Health
      </Link>

      <IpCompare locale="en" />
      <FooterLinks />
    </main>
  );
}
