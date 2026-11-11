"use server";

// Auth Server Actions for /login and the nav logout.
// They only write the session cookies and return a result: the client then
// calls syncSession() and navigates (see components/auth-form.tsx).
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null; ok: boolean };

const USERNAME_RE = /^[A-Z0-9_]{3,10}$/;
const MIN_PASSWORD = 6;

const ERR = {
  credentials: "CREDENCIALES INVÁLIDAS",
  username: "USUARIO NO VÁLIDO (3–10: A-Z, 0-9, _)",
  usernameTaken: "USUARIO YA EN USO",
  emailTaken: "EMAIL YA REGISTRADO",
  password: `CONTRASEÑA MÍNIMO ${MIN_PASSWORD} CARACTERES`,
  generic: "ERROR DE CONEXIÓN. INTÉNTALO DE NUEVO",
} as const;

const fail = (error: string): AuthState => ({ error, ok: false });

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export async function signInAction(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const email = field(form, "email").trim();
  const password = field(form, "password");
  if (!email || !password) return fail(ERR.credentials);

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error)
      return fail(
        error.code === "invalid_credentials" ? ERR.credentials : ERR.generic,
      );
    return { error: null, ok: true };
  } catch {
    return fail(ERR.generic);
  }
}

function signUpError(error: AuthError): string {
  switch (error.code) {
    case "user_already_exists":
    case "email_exists":
      return ERR.emailTaken;
    case "weak_password":
      return ERR.password;
    default:
      // Includes the trigger rejecting a duplicate username in a race (see spec risks).
      return ERR.generic;
  }
}

export async function signUpAction(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const username = field(form, "username").trim().toUpperCase();
  const email = field(form, "email").trim();
  const password = field(form, "password");

  if (!USERNAME_RE.test(username)) return fail(ERR.username);
  if (password.length < MIN_PASSWORD) return fail(ERR.password);

  try {
    const supabase = await createClient();

    // Friendly pre-check; the unique constraint on profiles is the real guarantee.
    const { data: taken, error: lookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (lookupError) return fail(ERR.generic);
    if (taken) return fail(ERR.usernameTaken);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) return fail(signUpError(error));
    // No session means "Confirm email" is still enabled in the project (spec step 6).
    if (!data.session) return fail(ERR.generic);

    return { error: null, ok: true };
  } catch {
    return fail(ERR.generic);
  }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
