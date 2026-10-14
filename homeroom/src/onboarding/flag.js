// hasCompletedOnboarding lives in the Supabase user metadata, so it follows the person to every device and needs no SQL.
// It is written as false the moment the ticket is stamped (the account is "in onboarding"), and true when the walkthrough ends.
// Accounts that existed before onboarding have no value at all and are left alone.

export const FLAG = "hasCompletedOnboarding";

export async function readOnboardingFlag(supabase) {
  try {
    const { data } = await supabase.auth.getSession();
    const v = data && data.session && data.session.user && data.session.user.user_metadata
      ? data.session.user.user_metadata[FLAG] : undefined;
    return typeof v === "boolean" ? v : undefined;
  } catch { return undefined; }
}

export async function writeOnboardingFlag(supabase, done) {
  try {
    const { error } = await supabase.auth.updateUser({ data: { [FLAG]: !!done } });
    return !error;
  } catch { return false; }
}
