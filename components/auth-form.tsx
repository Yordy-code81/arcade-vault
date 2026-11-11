"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useId,
  useState,
  type FormEvent,
} from "react";
import {
  signInAction,
  signUpAction,
  type AuthState,
} from "@/app/login/actions";
import { syncSession } from "@/lib/session";

type Tab = "in" | "up";
// `attempt` re-keys the error so its glitch animation replays on every failed submit.
type FormState = AuthState & { tab: Tab | null; attempt: number };

const INITIAL: FormState = { error: null, ok: false, tab: null, attempt: 0 };

export function AuthForm() {
  const router = useRouter();
  const id = useId();
  const [tab, setTab] = useState<Tab>("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");

  const [state, dispatch, pending] = useActionState(
    async (prev: FormState, form: FormData): Promise<FormState> => {
      const mode: Tab = form.get("mode") === "up" ? "up" : "in";
      const action = mode === "up" ? signUpAction : signInAction;
      const result = await action(prev, form);
      if (result.ok) {
        // The server wrote the auth cookies; let the browser store pick them up.
        await syncSession();
        router.push("/");
      }
      return { ...result, tab: mode, attempt: prev.attempt + 1 };
    },
    INITIAL,
  );

  // Submit through the action without React's automatic form reset,
  // so the (controlled) fields keep their values when there is an error.
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(() => dispatch(form));
  };

  // Only show the error of the tab that produced it.
  const error = state.tab === tab ? state.error : null;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : undefined;

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono mt-1.5 text-[11px] tracking-[0.16em] text-ink-faint">
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Tipo de acceso">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "in"}
            className={tab === "in" ? "on" : undefined}
            onClick={() => setTab("in")}
            disabled={pending}
          >
            INICIAR SESIÓN
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "up"}
            className={tab === "up" ? "on" : undefined}
            onClick={() => setTab("up")}
            disabled={pending}
          >
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit} aria-busy={pending}>
          <input type="hidden" name="mode" value={tab} />
          <fieldset disabled={pending}>
            {tab === "up" && (
              <div className="field slide-in">
                <label htmlFor={`${id}-user`}>Usuario</label>
                <input
                  id={`${id}-user`}
                  name="username"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="px_kai"
                  autoComplete="username"
                  required
                  aria-describedby={describedBy}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor={`${id}-email`}>Correo electrónico</label>
              <input
                id={`${id}-email`}
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                autoComplete="email"
                required
                aria-describedby={describedBy}
              />
            </div>
            <div className="field">
              <label htmlFor={`${id}-pass`}>Contraseña</label>
              <input
                id={`${id}-pass`}
                name="password"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                autoComplete={
                  tab === "in" ? "current-password" : "new-password"
                }
                required
                aria-describedby={describedBy}
              />
            </div>

            {error && (
              <p
                key={state.attempt}
                id={errorId}
                role="alert"
                className="auth-error"
              >
                ▸ {error}
              </p>
            )}

            <button
              className={"btn lg mt-2 w-full" + (pending ? " pulse" : "")}
              type="submit"
              disabled={pending}
            >
              {pending
                ? "CONECTANDO…"
                : tab === "in"
                  ? "ENTRAR AL VAULT"
                  : "CREAR Y JUGAR"}
            </button>
          </fieldset>
        </form>

        <button
          type="button"
          className="btn ghost mt-2.5 w-full"
          onClick={() => router.push("/")}
          disabled={pending}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        {/* Decorative only: OAuth is out of scope (see SPEC 02). */}
        <div className="social">
          <button className="btn ghost" type="button">
            ◆ GOOGLE
          </button>
          <button className="btn ghost" type="button">
            ▣ GITHUB
          </button>
        </div>

        <div className="mt-[18px] text-center text-[11px] tracking-[0.1em] text-ink-faint">
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
