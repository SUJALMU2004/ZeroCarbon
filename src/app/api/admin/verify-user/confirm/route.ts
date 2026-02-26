import { createHash } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AdminAction = "approve" | "reject" | "resubmit";

function renderPage(title: string, message: string, tone: "success" | "warning" | "error") {
  const color =
    tone === "success" ? "#166534" : tone === "warning" ? "#9a3412" : "#991b1b";
  const bg =
    tone === "success" ? "#f0fdf4" : tone === "warning" ? "#fff7ed" : "#fef2f2";
  const border =
    tone === "success" ? "#bbf7d0" : tone === "warning" ? "#fed7aa" : "#fecaca";

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a">
    <main style="max-width:760px;margin:48px auto;padding:0 16px">
      <section style="border:1px solid ${border};border-radius:14px;background:${bg};padding:24px">
        <h1 style="margin:0 0 10px;font-size:24px;color:${color}">${title}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#334155">${message}</p>
      </section>
    </main>
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

function parseAction(value: string): AdminAction | null {
  if (value === "approve" || value === "reject" || value === "resubmit") {
    return value;
  }
  return null;
}

export async function POST(request: Request) {
  let rawToken = "";
  let action = "";

  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = (await request.json()) as { token?: string; action?: string };
      rawToken = payload.token?.trim() ?? "";
      action = payload.action?.trim() ?? "";
    } else {
      const formData = await request.formData();
      rawToken = String(formData.get("token") ?? "").trim();
      action = String(formData.get("action") ?? "").trim();
    }
  } catch {
    return renderPage("Invalid verification link", "Request payload could not be parsed.", "error");
  }

  if (!rawToken) {
    return renderPage("Invalid verification link", "Missing verification token.", "error");
  }

  const parsedAction = parseAction(action);
  if (!parsedAction) {
    return renderPage("Invalid verification link", "Action is not supported.", "error");
  }

  try {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc("admin_apply_verification_action", {
      p_token: tokenHash,
      p_action: parsedAction,
    });

    if (error) {
      return renderPage("Verification action failed", "Unable to process this action right now.", "error");
    }

    const outcome = String(data ?? "");
    if (outcome === "approved") {
      return renderPage("User verification updated successfully.", "Status changed to verified.", "success");
    }

    if (outcome === "rejected") {
      return renderPage(
        "User verification updated successfully.",
        "Status changed to not verified.",
        "success",
      );
    }

    if (outcome === "resubmit_required") {
      return renderPage(
        "User verification updated successfully.",
        "Status changed to resubmit required.",
        "success",
      );
    }

    if (outcome === "expired") {
      return renderPage("Link expired", "This verification link has expired.", "warning");
    }

    if (outcome === "used") {
      return renderPage("Action already processed", "This verification link was already used.", "warning");
    }

    if (outcome === "already_verified") {
      return renderPage("Already verified", "User is already verified. No further action was applied.", "warning");
    }

    return renderPage("Invalid verification link", "Token is invalid or no longer available.", "error");
  } catch {
    return renderPage("Verification action failed", "Unexpected error while processing verification.", "error");
  }
}
