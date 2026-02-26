type AdminAction = "approve" | "reject" | "resubmit";

type SearchParams = {
  token?: string;
  action?: string;
};

function parseAction(value: string | undefined): AdminAction | null {
  if (value === "approve" || value === "reject" || value === "resubmit") {
    return value;
  }
  return null;
}

export default async function VerificationReviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const rawToken = params.token?.trim() ?? "";
  const suggestedAction = parseAction(params.action);

  if (!rawToken) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10 md:px-8">
        <section className="w-full rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-red-800">Invalid verification link</h1>
          <p className="mt-3 text-red-700">The verification token is missing from this link.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <section className="w-full rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Review Verification Request
        </h1>
        <p className="mt-3 text-slate-600">
          Choose an action below. The token is one-time use and expires automatically.
        </p>

        {suggestedAction ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Suggested action from email link: <span className="font-semibold">{suggestedAction}</span>
          </p>
        ) : null}

        <div className="mt-6 grid gap-3">
          <form method="POST" action="/api/admin/verify-user/confirm">
            <input type="hidden" name="token" value={rawToken} />
            <input type="hidden" name="action" value="approve" />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-emerald-500"
            >
              Verify User
            </button>
          </form>

          <form method="POST" action="/api/admin/verify-user/confirm">
            <input type="hidden" name="token" value={rawToken} />
            <input type="hidden" name="action" value="resubmit" />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl border border-amber-500 bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-amber-400"
            >
              Ask to Upload Different Document
            </button>
          </form>

          <form method="POST" action="/api/admin/verify-user/confirm">
            <input type="hidden" name="token" value={rawToken} />
            <input type="hidden" name="action" value="reject" />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-500"
            >
              Not Verify User
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
