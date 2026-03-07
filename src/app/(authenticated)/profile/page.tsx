import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/profile-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ProfileRow = {
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  phone_verified: boolean | null;
  phone_verified_at: string | null;
  profile_updated_at: string | null;
  verification_status:
    | "not_submitted"
    | "pending"
    | "verified"
    | "rejected"
    | "resubmit_required"
    | null;
  verification_document_type: string | null;
  verification_submitted_at: string | null;
};

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select(
      "full_name, email, avatar_url, created_at, date_of_birth, phone_number, address_line1, address_line2, city, state, postal_code, country, phone_verified, phone_verified_at, profile_updated_at, verification_status, verification_document_type, verification_submitted_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  let profile: ProfileRow = {
    full_name: profileData?.full_name ?? null,
    email: profileData?.email ?? null,
    avatar_url: profileData?.avatar_url ?? null,
    created_at: profileData?.created_at ?? null,
    date_of_birth: profileData?.date_of_birth ?? null,
    phone_number: profileData?.phone_number ?? null,
    address_line1: profileData?.address_line1 ?? null,
    address_line2: profileData?.address_line2 ?? null,
    city: profileData?.city ?? null,
    state: profileData?.state ?? null,
    postal_code: profileData?.postal_code ?? null,
    country: profileData?.country ?? null,
    phone_verified: profileData?.phone_verified ?? false,
    phone_verified_at: profileData?.phone_verified_at ?? null,
    profile_updated_at: profileData?.profile_updated_at ?? null,
    verification_status: profileData?.verification_status ?? "not_submitted",
    verification_document_type: profileData?.verification_document_type ?? null,
    verification_submitted_at: profileData?.verification_submitted_at ?? null,
  };
  const userEmail = user.email ?? "";

  // Keep profile email in sync with auth email when missing.
  if (userEmail && (!profile?.email || profile.email.trim().length === 0)) {
    const { error: syncError } = await supabase
      .from("profiles")
      .update({
        email: userEmail,
      })
      .eq("id", user.id);

    if (!syncError) {
      profile = {
        ...profile,
        email: userEmail,
      };
    }
  }

  const email = profile?.email?.trim() ? profile.email : userEmail || "Unavailable";

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <section className="w-full rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm backdrop-blur-sm sm:p-8 md:p-12">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
          Profile
        </h1>
        <p className="mt-3 text-slate-600">Manage your account profile and photo.</p>

        <ProfileForm
          userId={user.id}
          initialFullName={profile?.full_name ?? null}
          initialEmail={email}
          initialAvatarUrl={profile?.avatar_url ?? null}
          initialCreatedAt={profile?.created_at ?? null}
          initialDateOfBirth={profile?.date_of_birth ?? null}
          initialPhoneNumber={profile?.phone_number ?? null}
          initialAddressLine1={profile?.address_line1 ?? null}
          initialAddressLine2={profile?.address_line2 ?? null}
          initialCity={profile?.city ?? null}
          initialState={profile?.state ?? null}
          initialPostalCode={profile?.postal_code ?? null}
          initialCountry={profile?.country ?? null}
          initialPhoneVerified={Boolean(profile?.phone_verified)}
          initialPhoneVerifiedAt={profile?.phone_verified_at ?? null}
          initialVerificationStatus={profile?.verification_status ?? "not_submitted"}
          initialVerificationDocumentType={profile?.verification_document_type ?? null}
          initialVerificationSubmittedAt={profile?.verification_submitted_at ?? null}
        />
      </section>
    </main>
  );
}
