import { validateAdminRequest } from "@/lib/auth/request-auth";
import { syncGateRosterToGoogleSheet } from "@/lib/gate/google-sync";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await validateAdminRequest(request);
  if ("error" in auth) return auth.error;

  const result = await syncGateRosterToGoogleSheet(auth.serviceClient);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ count: result.count });
}
