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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderConfirmPage(rawToken: string, action: AdminAction) {
  const actionLabel =
    action === "approve"
      ? "Verify User"
      : action === "resubmit"
        ? "Ask to Upload Different Document"
        : "Not Verify User";
  const buttonBg = action === "approve" ? "#16a34a" : action === "resubmit" ? "#f59e0b" : "#dc2626";
  const safeToken = escapeHtml(rawToken);
  const safeAction = escapeHtml(action);

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Confirm verification action</title>
  </head>
  <body style="margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a">
    <main style="max-width:760px;margin:48px auto;padding:0 16px">
      <section style="border:1px solid #cbd5e1;border-radius:14px;background:#ffffff;padding:24px">
        <h1 style="margin:0 0 10px;font-size:24px;color:#0f172a">Confirm verification action</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155">
          This action updates the user verification status and can only be used once.
        </p>
        <form method="POST" action="/api/admin/verify-user/confirm" style="margin:0">
          <input type="hidden" name="token" value="${safeToken}" />
          <input type="hidden" name="action" value="${safeAction}" />
          <button type="submit" style="border:0;background:${buttonBg};color:#fff;padding:10px 14px;border-radius:8px;font-weight:600;cursor:pointer">
            ${actionLabel}
          </button>
        </form>
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawToken = url.searchParams.get("token")?.trim() ?? "";
  const action = url.searchParams.get("action")?.trim() ?? "";

  if (!rawToken) {
    return renderPage("Invalid verification link", "Missing verification token.", "error");
  }

  const allowedActions = new Set<AdminAction>(["approve", "reject", "resubmit"]);
  if (!allowedActions.has(action as AdminAction)) {
    return renderPage("Invalid verification link", "Action is not supported.", "error");
  }

  return renderConfirmPage(rawToken, action as AdminAction);
}
