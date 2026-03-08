import { NextRequest, NextResponse } from "next/server";
import { flowstateApi, isFlowStateEnabled } from "@/lib/flowstate-api";

export async function POST(request: NextRequest) {
  if (!isFlowStateEnabled() || !flowstateApi) {
    return NextResponse.json(
      { error: "FlowState API is not configured" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { role, user_id, message, session_id } = body as {
    role?: string;
    user_id?: string;
    message?: string;
    session_id?: string;
  };

  if (!role || !user_id || !message) {
    return NextResponse.json(
      { error: "Missing required fields: role, user_id, message" },
      { status: 400 }
    );
  }

  if (!["buyer", "seller", "admin"].includes(role)) {
    return NextResponse.json(
      { error: "Invalid role. Must be buyer, seller, or admin" },
      { status: 400 }
    );
  }

  try {
    const result = await flowstateApi.chatWithAgent({
      role: role as "buyer" | "seller" | "admin",
      user_id,
      message,
      session_id,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent chat failed" },
      { status: 500 }
    );
  }
}
