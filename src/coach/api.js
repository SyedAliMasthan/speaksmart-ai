import { supabase } from "../config/supabase";
export async function request(path, body = {}, signal) {
  if (!supabase)
    throw new Error("Practice is not available yet. Please try again later.");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in to continue.");
  const timeout = AbortSignal.timeout(45000);
  let response;
  try {
    response = await fetch(`/api/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      "Connection interrupted. Your saved conversation is safe. Please retry.",
    );
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      payload.error || "Unable to complete this request. Please retry.",
    );
  return payload;
}
export const coach = (action, body, signal) =>
  request(`coach/${action}`, body, signal);
