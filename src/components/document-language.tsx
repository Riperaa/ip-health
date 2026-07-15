"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function getDocumentLanguage(pathname: string) {
  return pathname === "/zh" || pathname.startsWith("/zh/") ? "zh-CN" : "en";
}

export function DocumentLanguage() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.lang = getDocumentLanguage(pathname);
  }, [pathname]);

  return null;
}
