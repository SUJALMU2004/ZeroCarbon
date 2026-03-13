import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ProjectVerifyForm from "@/app/(authenticated)/verify-project/ProjectVerifyForm";

export default async function VerifyProjectPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/verify-project");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone_verified, verification_status")
    .eq("id", user.id)
    .single();

  if (!profile?.phone_verified) {
    redirect("/profile?message=verify-phone");
  }

  if (profile?.verification_status !== "verified") {
    redirect("/profile?message=verify-identity");
  }

  return (
    <div className="min-h-full p-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Register Your Project
          </h1>
          <p className="mt-1 text-gray-500">
            Complete all steps to submit your carbon offset project for review.
          </p>
        </div>

        <ProjectVerifyForm userId={user.id} />
      </div>
    </div>
  );
}
