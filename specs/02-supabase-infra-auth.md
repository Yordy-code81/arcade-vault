# SPEC 02 — Supabase: infraestructura y autenticación

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-11-11
> **Objective:** Conectar la app a Supabase con `@supabase/ssr` y reemplazar la sesión mock de `localStorage["av_user"]` por Supabase Auth con email + contraseña y una tabla `profiles` que guarda el nombre de jugador.

---

## Por qué existe esta spec

SPEC 01 dejó la sesión como mock en `localStorage`, sin contraseña ni identidad real.
Las puntuaciones y los rankings reales (specs siguientes) necesitan un `user.id` fiable y un nombre de jugador único.
Integrar Supabase completo toca cuatro dominios (infra, auth, catálogo, puntuaciones), así que se dividió en tres specs:

- **SPEC 02 (esta):** infraestructura Supabase + autenticación + `profiles`.
- **SPEC 03:** tabla `games` en Supabase con el catálogo de `lib/data.ts`.
- **SPEC 04:** tabla de puntuaciones, leaderboard del Detalle y Salón de la Fama reales.

---

## Alcance

**Dentro:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local`, más un `.env.example` versionado.
- Clientes Supabase: navegador (`lib/supabase/client.ts`) y servidor (`lib/supabase/server.ts`).
- `proxy.ts` en la raíz (Next 16 renombró `middleware` a `proxy`) que refresca la sesión en cada petición y redirige `/login` → `/` si ya hay sesión.
- Carpeta `supabase/migrations/` con la migración de `public.profiles`, su trigger y sus políticas RLS, aplicada al proyecto remoto.
- Tipos de la base de datos generados en `lib/supabase/database.types.ts`.
- Server Actions de login, registro y logout en `app/login/actions.ts`.
- Formulario de `/login` adaptado:
  - INICIAR SESIÓN: Email + Contraseña.
  - CREAR CUENTA: Usuario + Email + Contraseña.
  - Mensajes de error visibles en el formulario y botón deshabilitado mientras se envía.
- `lib/session.ts` reescrito: misma firma `useSession()` pero alimentado por Supabase Auth + `profiles`.
- Logout desde el nav (pulsar el nombre) usando la Server Action.
- "JUGAR COMO INVITADO" sigue existiendo: navega a `/` sin sesión.
- Desactivar "Confirm email" en el proveedor Email del proyecto Supabase (paso manual en el dashboard).

**Fuera de alcance (para specs futuras):**

- Tabla `games` y lectura del catálogo desde Supabase (SPEC 03).
- Tabla de puntuaciones, leaderboard y Salón de la Fama reales (SPEC 04). `localStorage["av_scores"]` sigue igual.
- OAuth Google / GitHub (los botones siguen decorativos).
- Confirmación de email, recuperación de contraseña y cambio de email.
- Edición del perfil (cambiar nombre de jugador, avatar).
- Anonymous sign-in de Supabase para invitados.
- Rutas protegidas (todas las páginas siguen siendo públicas).
- Tests automatizados.

---

## Modelo de datos

### Base de datos

Migración `supabase/migrations/20261111000000_profiles.sql`:

```sql
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (username ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Lectura pública: los rankings de SPEC 04 mostrarán nombres de otros jugadores.
create policy "profiles are readable by everyone"
  on public.profiles for select to anon, authenticated using (true);

-- Sin políticas de insert/update/delete: solo el trigger escribe.
```

Trigger `on_auth_user_created` (`after insert on auth.users`) que llama a `public.handle_new_user()`:

- Función `security definer` con `set search_path = ''`.
- Inserta `(new.id, upper(new.raw_user_meta_data ->> 'username'))` en `public.profiles`.
- Si el username no cumple el `check` o ya existe, el insert falla y Supabase rechaza el registro completo (no quedan usuarios sin perfil).

### Código

`lib/supabase/database.types.ts`: generado con la herramienta `generate_typescript_types` del MCP de Supabase. No se edita a mano.

`lib/session.ts` (client-only):

```ts
export interface SessionUser {
  id: string; // auth.users.id
  name: string; // profiles.username (MAYÚSCULAS, 3–10, A-Z 0-9 _)
}

export function useSession(): SessionUser | null; // useSyncExternalStore, snapshot de servidor = null
export function syncSession(): Promise<void>; // relee getUser() + profile y notifica a los suscriptores
```

- El store se inicializa en la primera suscripción con `supabase.auth.getUser()` y luego `select username from profiles where id = …`.
- Escucha `supabase.auth.onAuthStateChange` para cambios en otras pestañas o al expirar el token.
- `signIn` / `signOut` desaparecen de este archivo. El login y el logout pasan a ser Server Actions.

`app/login/actions.ts` (`"use server"`):

```ts
export type AuthState = { error: string | null; ok: boolean };

export async function signInAction(
  prev: AuthState,
  form: FormData,
): Promise<AuthState>;
export async function signUpAction(
  prev: AuthState,
  form: FormData,
): Promise<AuthState>;
export async function signOutAction(): Promise<void>;
```

Campos del `FormData`: `email`, `password` y, solo en registro, `username`.

Mensajes de error (texto exacto que muestra el formulario):

| Caso                                                              | Mensaje                                 |
| ----------------------------------------------------------------- | --------------------------------------- |
| Email o contraseña incorrectos                                    | `CREDENCIALES INVÁLIDAS`                |
| Username fuera de `^[A-Z0-9_]{3,10}$` (tras pasarlo a mayúsculas) | `USUARIO NO VÁLIDO (3–10: A-Z, 0-9, _)` |
| Username ya existe en `profiles`                                  | `USUARIO YA EN USO`                     |
| Email ya registrado                                               | `EMAIL YA REGISTRADO`                   |
| Contraseña de menos de 6 caracteres                               | `CONTRASEÑA MÍNIMO 6 CARACTERES`        |
| Cualquier otro error de Supabase o de red                         | `ERROR DE CONEXIÓN. INTÉNTALO DE NUEVO` |

Convenciones:

- El username se normaliza con `trim().toUpperCase()` antes de validar.
- `signUpAction` comprueba la unicidad del username con un `select` sobre `profiles` antes de llamar a `auth.signUp`, para dar un error legible. El `unique` de la tabla sigue siendo la garantía real.
- El username viaja a `auth.signUp` en `options.data.username`.
- `localStorage["av_user"]` deja de leerse y escribirse. Una clave antigua que quede en el navegador simplemente se ignora.

---

## Estructura de archivos

```text
.env.example                         (nuevo: las dos variables con valores vacíos)
.gitignore                           (modificado: añadir !.env.example)
proxy.ts                             (nuevo: llama a updateSession; matcher excluye estáticos)
supabase/
  migrations/
    20261111000000_profiles.sql      (nuevo)
lib/
  supabase/
    client.ts                        (nuevo: createBrowserClient<Database>)
    server.ts                        (nuevo: createServerClient<Database> con await cookies())
    proxy.ts                         (nuevo: updateSession(request) + redirección de /login)
    database.types.ts                (nuevo, generado)
  session.ts                         (reescrito)
app/
  login/
    actions.ts                       (nuevo)
components/
  auth-form.tsx                      (modificado: useActionState + Server Actions + errores)
  nav.tsx                            (modificado: logout con signOutAction + syncSession)
  game-player.tsx                    (sin cambios de lógica; sigue usando useSession().name)
  hall-of-fame.tsx                   (sin cambios de lógica)
```

---

## Plan de implementación

1. Instalar `@supabase/supabase-js` y `@supabase/ssr`. Crear `.env.example` y añadir `!.env.example` a `.gitignore`. Añadir los valores reales a `.env.local` (URL y publishable key con `get_project_url` / `get_publishable_keys` del MCP). Verificar con `npm run build`.
2. Crear `lib/supabase/client.ts` y `lib/supabase/server.ts` siguiendo la guía de `@supabase/ssr` para App Router, sin tipar todavía. Verificar con `npm run build`.
3. Crear `lib/supabase/proxy.ts` (`updateSession`) y `proxy.ts` en la raíz, consultando antes `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`. El matcher excluye `_next/static`, `_next/image`, `favicon.ico` e imágenes. Prueba manual: `npm run dev`, todas las rutas de SPEC 01 siguen cargando.
4. Escribir `supabase/migrations/20261111000000_profiles.sql` (tabla, RLS, política de lectura, función y trigger). Aplicarla al proyecto remoto con `apply_migration` del MCP usando el mismo nombre. Pasar `get_advisors` (security) y corregir avisos sobre `profiles` o `handle_new_user`.
5. Generar `lib/supabase/database.types.ts` con `generate_typescript_types` y tipar los dos clientes con `<Database>`. Verificar con `npm run build`.
6. Desactivar "Confirm email" en Authentication → Sign In / Providers → Email del dashboard de Supabase (paso manual del usuario).
7. Crear `app/login/actions.ts` con `signInAction`, `signUpAction` y `signOutAction`, más la validación y los mensajes de la tabla. Verificar con `npm run build`.
8. Reescribir `lib/session.ts` con el store sobre Supabase Auth (`useSession`, `syncSession`). Quitar `signIn` / `signOut`. Verificar con `npm run build`: fallará en `auth-form.tsx` y `nav.tsx` hasta el paso 9, así que los pasos 8 y 9 van en el mismo commit.
9. Adaptar `components/auth-form.tsx` (campos por pestaña, `useActionState`, error visible, botón deshabilitado con texto `CONECTANDO…` mientras `pending`, y en `ok` → `await syncSession()` + `router.push("/")`) y `components/nav.tsx` (pulsar el nombre → `signOutAction()` + `syncSession()`). "JUGAR COMO INVITADO" solo hace `router.push("/")`. Prueba manual: registro, logout y login funcionan y el nav refleja el estado.
10. Aplicar `/frontend-design` al bloque de error y al estado `pending` del formulario, respetando la estética retro existente. Pasar `npm run lint` y `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de tipos ni de prerender.
- [ ] `npm run lint` termina sin errores.
- [ ] `.env.example` está versionado con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valores; `.env.local` no está versionado.
- [ ] `supabase/migrations/20261111000000_profiles.sql` existe y `list_migrations` del MCP la muestra aplicada en el proyecto remoto.
- [ ] `public.profiles` tiene RLS activado y `get_advisors` (security) no reporta avisos sobre `profiles` ni `handle_new_user`.
- [ ] Todas las rutas de SPEC 01 cargan sin errores en la consola del navegador, con y sin sesión.
- [ ] En `/login`, la pestaña INICIAR SESIÓN muestra solo Email y Contraseña; CREAR CUENTA muestra Usuario, Email y Contraseña.
- [ ] Crear cuenta con usuario `px_kai`, un email nuevo y contraseña de 6+ caracteres redirige a `/`, y el nav muestra `PX_KAI ▾`.
- [ ] Tras ese registro existe una fila en `public.profiles` con `username = 'PX_KAI'` y el mismo `id` que el usuario en `auth.users`.
- [ ] Crear cuenta con un usuario ya existente muestra `USUARIO YA EN USO` y no crea filas en `auth.users`.
- [ ] Crear cuenta con usuario `ab` o `hola mundo` muestra `USUARIO NO VÁLIDO (3–10: A-Z, 0-9, _)`.
- [ ] Crear cuenta con un email ya registrado muestra `EMAIL YA REGISTRADO`.
- [ ] Crear cuenta con contraseña de 5 caracteres muestra `CONTRASEÑA MÍNIMO 6 CARACTERES`.
- [ ] Iniciar sesión con contraseña incorrecta muestra `CREDENCIALES INVÁLIDAS`.
- [ ] Mientras se envía el formulario el botón está deshabilitado y muestra `CONECTANDO…`.
- [ ] Recargar la página conserva la sesión (el nav sigue mostrando el nombre).
- [ ] Pulsar el nombre en el nav cierra la sesión y vuelve a mostrar "Iniciar Sesión", también tras recargar.
- [ ] Con sesión iniciada, visitar `/login` redirige a `/`.
- [ ] "JUGAR COMO INVITADO" navega a `/` sin sesión.
- [ ] Con sesión, el Salón muestra "▸ TU MEJOR MARCA EN <JUEGO>" y el Reproductor guarda en `av_scores` con `name` igual al username del perfil.
- [ ] Ningún archivo lee ni escribe `localStorage["av_user"]`.

---

## Decisiones

- **Sí:** dividir Supabase en tres specs (02 infra + auth, 03 catálogo `games`, 04 puntuaciones). La primera propuesta abarcaba cuatro dominios y una PR enorme.
- **Sí:** `@supabase/ssr` con cliente browser y cliente server. Es la integración oficial para App Router con sesión en cookies.
- **No:** `@supabase/auth-helpers-nextjs`. Está deprecado en favor de `@supabase/ssr`.
- **Sí:** `proxy.ts` (no `middleware.ts`). Next 16 deprecó `middleware` y lo renombró a `proxy`.
- **Sí:** variables `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Las publishable keys sustituyen a la `anon` key legacy.
- **No:** `service_role` / secret key en la app. Nada en esta spec necesita saltarse RLS.
- **Sí:** email + contraseña. Encaja con el formulario actual.
- **No:** OAuth ni magic link en esta spec. OAuth exige configurar proveedores; magic link cambia el diseño del formulario.
- **Sí:** tabla `public.profiles` rellenada por trigger desde `raw_user_meta_data.username`. Garantiza unicidad y que no queden usuarios sin perfil.
- **No:** guardar el nombre solo en `user_metadata`. No garantiza unicidad y SPEC 04 necesita hacer join por nombre.
- **No:** login con nombre de usuario (buscar el email por username). Más complejo y revela qué cuentas existen.
- **Sí:** username `^[A-Z0-9_]{3,10}$` en mayúsculas. Mantiene el límite de 10 del MVP y se ve bien en la estética arcade.
- **Sí:** lectura pública de `profiles`. Los rankings de SPEC 04 mostrarán nombres de otros jugadores.
- **Sí:** confirmación de email desactivada. Evita configurar SMTP y la ruta de callback; el registro inicia sesión al instante.
- **Sí:** Server Actions para login, registro y logout. Validan en servidor y escriben las cookies de sesión.
- **No:** llamar a `supabase.auth.*` directamente desde el formulario. Dejaría la validación solo en cliente.
- **Sí:** `useSession()` con la misma firma, alimentado por el cliente browser. El layout sigue siendo un shell estático con `cacheComponents` y los componentes casi no cambian.
- **No:** leer la sesión en servidor dentro del layout. Volvería dinámico todo el layout y obligaría a añadir `<Suspense>` en el nav.
- **Sí:** `syncSession()` explícito tras cada Server Action. Las cookies las escribe el servidor y el cliente browser no se entera solo.
- **Sí:** modo invitado sin sesión (no anonymous sign-in). No requiere cambios de BD; el invitado no podrá guardar puntuaciones cuando llegue SPEC 04.
- **Sí:** ninguna ruta protegida; solo `/login` redirige a `/` si hay sesión, desde `proxy.ts`. Hacerlo en el proxy evita volver dinámica la página `/login`.
- **Sí:** migraciones versionadas en `supabase/migrations/` y aplicadas con `apply_migration` del MCP con el mismo nombre. El esquema queda en el repo y es revisable en PR.
- **No:** cambios de esquema solo desde el dashboard. No quedan trazables.
- **Sí:** `av_scores` sigue en `localStorage` hasta SPEC 04, ahora con el username del perfil.

---

## Riesgos

| Riesgo                                                                                                                      | Mitigación                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| La comprobación previa de username y el insert del trigger no son atómicos (dos registros simultáneos con el mismo nombre). | El `unique` de `profiles` hace fallar el segundo `signUp`; su error se muestra como `ERROR DE CONEXIÓN. INTÉNTALO DE NUEVO`. Aceptado.     |
| El nav muestra "Iniciar Sesión" mientras se resuelve `getUser()` + perfil (snapshot inicial `null`).                        | Aceptado, igual que en SPEC 01. Es un parpadeo breve y no rompe la hidratación.                                                            |
| Si se olvida desactivar "Confirm email", `signUp` no devuelve sesión y el usuario queda en `/login` sin explicación.        | El paso 6 es explícito. `signUpAction` trata "registro sin sesión" como error `ERROR DE CONEXIÓN. INTÉNTALO DE NUEVO` en vez de redirigir. |
| `proxy.ts` llama a `getUser()` en cada petición y añade latencia.                                                           | El matcher excluye estáticos e imágenes. Es el patrón recomendado por `@supabase/ssr` para refrescar tokens.                               |
| APIs de Next 16 (`proxy`, `cookies()` asíncrono, Server Actions con `cacheComponents`) distintas a las conocidas.           | Consultar `node_modules/next/dist/docs/01-app/` antes de cada paso, como exige `AGENTS.md`.                                                |
| La publishable key acaba en el bundle del cliente.                                                                          | Es pública por diseño; la seguridad la dan las políticas RLS. Nunca se usa la secret key en la app.                                        |
| Los usuarios de prueba creados durante la verificación quedan en el proyecto remoto.                                        | Borrarlos desde el dashboard tras validar; `on delete cascade` limpia `profiles`.                                                          |

---

## Lo que **no** está en esta spec

- Tabla `games` ni catálogo desde Supabase (SPEC 03).
- Puntuaciones en base de datos, leaderboard ni Salón reales (SPEC 04).
- OAuth Google / GitHub.
- Confirmación de email, recuperación de contraseña, cambio de email.
- Edición del perfil.
- Anonymous sign-in.
- Rutas protegidas.
- Tests automatizados.

Cada uno de esos puntos, si llega, va en su propia spec.
