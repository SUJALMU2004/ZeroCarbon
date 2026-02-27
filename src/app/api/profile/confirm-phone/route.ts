import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      message:
        "This endpoint is deprecated. Use /api/phone/verify-otp for Twilio Verify based phone confirmation.",
      code: "deprecated_endpoint",
    },
    { status: 410 },
  );
}
