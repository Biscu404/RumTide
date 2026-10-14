import { useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props { client: SupabaseClient }

/** Email and password. Signing in or creating an account is all that happens here. */
export function Login({ client }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(mode: "signIn" | "signUp", event: Event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const { data, error } = mode === "signIn"
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signUp({ email, password });
    setBusy(false);
    if (error) setMessage(error.message);
    else if (mode === "signUp" && !data.session) setMessage("Check your email to confirm the account, then sign in.");
    // On success the session listener in App takes over.
  }

  return (
    <form class="login" onSubmit={(e) => submit("signIn", e)}>
      <h1>Rumtide</h1>
      <label>
        Email
        <input type="email" value={email} autoComplete="email" required onInput={(e) => setEmail(e.currentTarget.value)} />
      </label>
      <label>
        Password
        <input
          type="password" value={password} autoComplete="current-password" minLength={6} required
          onInput={(e) => setPassword(e.currentTarget.value)}
        />
      </label>
      {message && <p class="notice" role="alert">{message}</p>}
      <div class="row">
        <button type="submit" disabled={busy}>Sign in</button>
        <button type="button" class="secondary" disabled={busy || !email || password.length < 6} onClick={(e) => submit("signUp", e)}>
          Create account
        </button>
      </div>
    </form>
  );
}
