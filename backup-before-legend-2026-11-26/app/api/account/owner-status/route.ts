import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tubex-backend";
import { isTubeXOwner } from "@/lib/tubex-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ isOwner: false }, { status: 401 });
  const isOwner = await isTubeXOwner(user);
  return NextResponse.json({ isOwner, userId: user.id }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
