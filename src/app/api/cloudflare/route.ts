import { NextResponse } from "next/server";

import { lookup } from "@/lib/providers/cloudflare";
import { isProviderLookupError } from "@/lib/providers/errors";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    return NextResponse.json(await lookup());
  } catch (error) {
    if (isProviderLookupError(error)) {
      return errorResponse("Unable to check network integrity.", error.status);
    }

    return errorResponse("Unable to check network integrity.", 502);
  }
}
