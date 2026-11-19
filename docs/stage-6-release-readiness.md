# Shelf — Stage 6: Release & Deployment Readiness Guide

**Target Application:** Shelf (`Everything worth keeping`)  
**Technology Stack:** React 19 · TypeScript 5.7 · Vite 6.4 · Tailwind CSS 3.4 · Supabase (PostgreSQL 15+, GoTrue, Deno Edge Functions)  
**Status:** Release-Prepared · Awaiting Explicit Production Authorization  
**Document Classification:** Pre-Deployment Runbook & Architecture Verification  

---

> [!WARNING]
> **SAFETY & AUTHORIZATION DIRECTIVE**  
> This document specifies prerequisites, validation procedures, and runbooks for a future authorized production release. It does **not** authorize an automated or immediate deployment.  
> - Do not execute live database migrations without explicit approval.  
> - Do not publish the application publicly or alter production DNS/hosting.  
> - Do not deploy the `delete-account` Edge Function or set remote secrets until authorized.  
> - Never place Supabase `service_role` keys, private keys, or master credentials into client-facing configuration.

---

## Table of Contents

1. [Section A — Application Architecture](#section-a--application-architecture)
2. [Section B — Environment Configuration](#section-b--environment-configuration)
3. [Section C — Authentication & Redirect Configuration](#section-c--authentication--redirect-configuration)
4. [Section D — Database Migration & Schema Verification](#section-d--database-migration--schema-verification)
5. [Section E — Delete-Account Edge Function Preparation](#section-e--delete-account-edge-function-preparation)
6. [Section F — Hosting & Routing Architecture](#section-f--hosting--routing-architecture)
7. [Section G — Release Smoke-Test Checklist](#section-g--release-smoke-test-checklist)
8. [Section H — Rollback & Troubleshooting Runbook](#section-h--rollback--troubleshooting-runbook)

---

## Section A — Application Architecture

Shelf is a desktop-first personal bookmark management web application designed around modern minimalism, typography-first aesthetics (Newsreader + Inter), and intentional curation.

### Core Architectural Principles
1. **Online-Only Persistence:**  
   Shelf operates strictly online. It does **not** support offline-first mutations, background sync queues, service-worker caching for API data, or local IndexedDB writes. Every bookmark, collection, and tag operation communicates synchronously with authenticated Supabase PostgreSQL endpoints. Internet connectivity is mandatory for normal data access.
2. **Supabase Cloud Persistence:**  
   All persistent state resides in PostgreSQL under authenticated Row-Level Security (RLS). Bookmark-tag relationships are managed atomically through transactional PostgreSQL functions (`public.save_bookmark_with_tags`).
3. **No Realtime Subscriptions:**  
   Shelf intentionally does **not** open persistent Supabase Realtime WebSocket connections. Multi-tab updates reflect following regular page navigation or ordinary user reloads.
4. **Vite Production Build & Code Splitting:**  
   The client bundles through Vite with dynamic route-level splitting (`React.lazy` + `<Suspense>`) and segregated vendor chunks (`vendor-react`, `vendor-supabase`), guaranteeing that all chunks remain comfortably under Vite's 500 kB threshold.
5. **Hash-Based Client-Side Routing:**  
   Navigation uses standard URL hash fragments (`/#/`, `/#/all`, `/#/favourites`, `/#/collections`, `/#/collections/:id`, `/#/tags`, `/#/tags/:id`, `/#/settings`). This ensures zero dependency on server-side SPA rewrite rules for deep linking and page refresh.
6. **Migration & Cutover Gate:**  
   The authenticated shell is wrapped in `<MigrationGate>`, preventing any desynchronized cloud operations if an account requires schema initialization or legacy data reconciliation.

---

## Section B — Environment Configuration

Shelf requires two client-facing environment variables injected at build time via Vite's `import.meta.env` system.

### 1. Required Variables

| Variable Name | Required Scope | Example / Format | Purpose |
| :--- | :---: | :--- | :--- |
| `VITE_SUPABASE_URL` | Public (Client) | `https://<project-ref>.supabase.co` | Supabase API Gateway endpoint |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public (Client) | `sbp_...` or JWT anon key | Public publishable / anonymous key |

### 2. Development vs. Production Configuration

* **Local Development (`.env`):**
  ```bash
  # Local Development .env (.env)
  VITE_SUPABASE_URL=https://<your-staging-or-dev-ref>.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=<your-development-anon-key>
  ```
* **Production CI/CD & Hosting Environment:**
  Configure environment variables directly in your hosting platform dashboard (e.g. Cloudflare Pages, Vercel, Netlify, or Docker build args).
  ```bash
  VITE_SUPABASE_URL=https://<your-production-ref>.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=<your-production-anon-key>
  ```

### 3. `.env.example` Instructions
The root repository includes `.env.example`:
```bash
# Supabase Configuration
# Replace with your project details
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```
When setting up a new environment, copy `.env.example` to `.env` and immediately substitute real credentials.

### 4. Missing or Placeholder Configuration Guard
In [src/lib/supabase.ts](file:///C:/Users/Admin/shelf/src/lib/supabase.ts), `validateSupabaseConfig()` explicitly checks for missing keys, malformed URLs, and placeholder values:
* If variables are missing, empty, or contain template strings (`your-project`, `<your-...>`, `placeholder`), `isSupabaseConfigured` evaluates to `false`.
* `getSupabaseClient()` throws a descriptive initialization error rather than initiating broken network requests.
* `AuthContext` detects unconfigured state immediately, safely disabling authentication actions with `"Supabase is not configured"` before any network request is attempted.

### 5. Critical Security Warning

> [!CAUTION]
> **NEVER EXPOSE SERVICE-ROLE KEYS**  
> Under no circumstances should `SUPABASE_SERVICE_ROLE_KEY` or any administrative secret be prefixed with `VITE_` or added to `.env`, `.env.example`, or client repository code.  
> Vite embeds all `VITE_*` environment variables directly into client-side JavaScript bundles. Exposing a service-role key gives unauthenticated public users full administrative bypass of PostgreSQL Row-Level Security.

---

## Section C — Authentication & Redirect Configuration

Shelf uses Supabase GoTrue with PKCE (Proof Key for Code Exchange) flow (`flowType: 'pkce'`), session persistence in browser storage, and automatic token refresh.

### 1. Supabase Dashboard URL Configuration
Navigate to **Supabase Dashboard > Authentication > URL Configuration**:

* **Site URL:**
  * Development: `http://localhost:5174`
  * Production: `https://<your-production-domain>` (e.g. `https://shelf.app`)
* **Redirect URLs (Allowed Callback URLs):**
  Add the following explicit entries to the Redirect URLs allowlist:
  * `http://localhost:5174/**`
  * `http://localhost:5174/#/**`
  * `https://<your-production-domain>/**`
  * `https://<your-production-domain>/#/**`

### 2. Email Confirmation Flow
* **Behavior:** When user registration requires email confirmation, Supabase dispatches a confirmation email containing a verification token link.
* **Email Template:** In **Supabase Dashboard > Authentication > Email Templates > Confirm Signup**, use the standard confirmation link:
  ```html
  <h2>Confirm your signup</h2>
  <p>Follow this link to confirm your user:</p>
  <p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>
  ```
* **Redirection & Verification:** Clicking `{{ .ConfirmationURL }}` routes through Supabase's verification endpoint (`/auth/v1/verify`), validates the token, and redirects the browser to the Site URL (`{{ .SiteURL }}/#/`). `AuthContext` hydrates the session, unlocking the authenticated application shell.

### 3. Password Recovery Flow
* When a user requests a password reset from `AuthPage` ("Forgot Password"), [AuthContext.tsx](file:///C:/Users/Admin/shelf/src/context/AuthContext.tsx) invokes `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })`.
* **Email Template:** In **Supabase Dashboard > Authentication > Email Templates > Reset Password**, use the standard Supabase recovery link:
  ```html
  <h2>Reset Password</h2>
  <p>Follow this link to reset the password for your user:</p>
  <p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
  ```
  *(Note: Do not use `{{ .Token }}` in URL query/hash parameters; in Supabase, `{{ .Token }}` represents a 6-digit numeric OTP, whereas `{{ .ConfirmationURL }}` contains the complete signed verification link).*
* **End-to-End Recovery Flow:**
  1. The user clicks `{{ .ConfirmationURL }}` in their email.
  2. Supabase verifies the single-use recovery token at `https://<project-ref>.supabase.co/auth/v1/verify?token={{ .TokenHash }}&type=recovery&redirect_to={{ .RedirectTo }}`.
  3. Supabase validates the hash and redirects the browser back to Shelf's origin (`redirectTo`), attaching the PKCE authorization code:
     `https://<your-production-domain>/?code=<recovery-code>`
  4. Shelf's Supabase client (`flowType: 'pkce'`, `detectSessionInUrl: true`) detects `?code=...` and automatically exchanges it for an authenticated recovery session.
  5. Upon exchange, Supabase emits the `PASSWORD_RECOVERY` event on `onAuthStateChange`.
  6. [AuthContext.tsx](file:///C:/Users/Admin/shelf/src/context/AuthContext.tsx) handles `event === 'PASSWORD_RECOVERY'`, sets `isPasswordRecovery: true`, and records `sessionStorage.setItem('shelf_in_password_recovery', '1')` to preserve the recovery view across page reloads.
  7. [App.tsx](file:///C:/Users/Admin/shelf/src/App.tsx) detects `isPasswordRecovery === true` and renders `<AuthPage initialMode="reset-password" ... />`.
  8. The user enters their new password and submits the form, which calls `updatePassword(newPassword)` -> `supabase.auth.updateUser({ password: newPassword })`.
  9. Upon successful update, `sessionStorage.removeItem('shelf_in_password_recovery')` and `clearPasswordRecovery()` reset recovery flags, transitioning the user into the normal authenticated application.
* **Recovery Error & Expiration Handling:**
  If the reset link has expired, was already consumed, or is invalid, Supabase redirects back with error parameters (`error_code=otp_expired` or `error_description=...`). [AuthContext.tsx](file:///C:/Users/Admin/shelf/src/context/AuthContext.tsx) intercepts these parameters and displays a clear user notice: *"The password reset link is invalid or has expired. Please request a fresh reset link."*
* **Fallback for Stranded Hash Codes:**
  If older email templates or custom proxies deliver the code in the hash fragment (`/#/?code=...` or `/#code=...`), [AuthContext.tsx](file:///C:/Users/Admin/shelf/src/context/AuthContext.tsx) extracts the hash code and manually invokes `supabase.auth.exchangeCodeForSession(code)` as a resilience fallback.

### 4. Google OAuth Flow (Optional)
If Google Sign-In is enabled in **Supabase Dashboard > Authentication > Providers > Google**:
* **Authorized Redirect URI in Google Cloud Console:**
  `https://<project-ref>.supabase.co/auth/v1/callback`
* In Shelf, clicking "Sign in with Google" invokes `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`.
* Upon completion, the browser returns to the origin and GoTrue hydrates the session.

---

## Section D — Database Migration & Schema Verification

Shelf's cloud persistence schema was authored and verified in Stage 5.

### 1. Existing Migration Files
Located in [supabase/migrations/](file:///C:/Users/Admin/shelf/supabase/migrations/):
* `20261118_stage5_cloud_persistence.sql`

> [!IMPORTANT]
> **DO NOT RE-RUN APPLIED MIGRATIONS**  
> If this migration has already been executed against the target Supabase project, do not re-run it blindly. The schema file uses `CREATE TABLE IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`, and `CREATE OR REPLACE FUNCTION`, but manually re-running DDL on production databases risks table locks or metadata conflicts.

### 2. Schema Specification Checklist

Ensure the production database contains the following exact tables, constraints, and triggers:

#### Tables & Primary Keys
* **`public.collections`**
  * `id` (`TEXT NOT NULL PRIMARY KEY`)
  * `user_id` (`UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`)
  * `name` (`TEXT NOT NULL`, `CHECK (length(trim(name)) > 0)`)
  * `description` (`TEXT NULL`)
  * `color` (`TEXT NULL`)
  * `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`)
  * `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`)
  * Unique constraint: `uq_collections_user_id (user_id, id)`
  * Unique index: `idx_collections_user_lower_name (user_id, lower(trim(name)))`
* **`public.tags`**
  * `id` (`TEXT NOT NULL PRIMARY KEY`)
  * `user_id` (`UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`)
  * `name` (`TEXT NOT NULL`, `CHECK (length(trim(name)) > 0)`)
  * `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`)
  * `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`)
  * Unique constraint: `uq_tags_user_id (user_id, id)`
  * Unique index: `idx_tags_user_lower_name (user_id, lower(trim(name)))`
* **`public.bookmarks`**
  * `id` (`TEXT NOT NULL PRIMARY KEY`)
  * `user_id` (`UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`)
  * `url` (`TEXT NOT NULL`, `CHECK (length(trim(url)) > 0)`)
  * `title` (`TEXT NOT NULL`, `CHECK (length(trim(title)) > 0)`)
  * `domain` (`TEXT NOT NULL`)
  * `description` (`TEXT NULL`), `favicon` (`TEXT NULL`), `preview_image` (`TEXT NULL`)
  * `collection_id` (`TEXT NULL`)
  * `is_favourite` (`BOOLEAN NOT NULL DEFAULT false`)
  * `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`)
  * `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`)
  * Composite FK: `(user_id, collection_id) REFERENCES public.collections (user_id, id) ON DELETE SET NULL (collection_id)`
  * Unique constraint: `uq_bookmarks_user_id (user_id, id)`
* **`public.bookmark_tags`**
  * `bookmark_id` (`TEXT NOT NULL`), `tag_id` (`TEXT NOT NULL`)
  * `user_id` (`UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`)
  * `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`)
  * Primary key: `(bookmark_id, tag_id)`
  * Composite FK 1: `(user_id, bookmark_id) REFERENCES public.bookmarks (user_id, id) ON DELETE CASCADE`
  * Composite FK 2: `(user_id, tag_id) REFERENCES public.tags (user_id, id) ON DELETE CASCADE`

#### Automated Triggers
* Trigger function: `public.fn_set_updated_at()` (`SECURITY INVOKER`, updates `updated_at` to `clock_timestamp()` while enforcing immutable `created_at`).
* Attached to: `trg_collections_updated_at`, `trg_tags_updated_at`, `trg_bookmarks_updated_at`.

#### Transactional Helper Function
* Function: `public.save_bookmark_with_tags(p_bookmark JSONB, p_tag_ids TEXT[])`
* Security: `SECURITY INVOKER`, executes under the caller's `auth.uid()`.
* Permissions: `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`.
* Collision Guard: Asserts `GET DIAGNOSTICS ROW_COUNT > 0` before mutating tag joins to prevent cross-account ID updates.

### 3. RLS Verification Commands
Verify that RLS is active and enforced on all tables by running this SQL query in the Supabase SQL Editor:
```sql
SELECT 
    schemaname, 
    tablename, 
    rowsecurity AS rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('collections', 'tags', 'bookmarks', 'bookmark_tags');
```
*Expected Result:* `rls_enabled` must be `true` for all four tables.

To verify that anonymous users have zero select access:
```sql
SELECT table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE grantee = 'anon' 
  AND table_schema = 'public'
  AND table_name IN ('collections', 'tags', 'bookmarks', 'bookmark_tags');
```
*Expected Result:* Zero rows returned.

---

## Section E — Delete-Account Edge Function Preparation

The Edge Function source is located at [supabase/functions/delete-account/index.ts](file:///C:/Users/Admin/shelf/supabase/functions/delete-account/index.ts).

### 1. Purpose & Security Model
* Self-service permanent account erasure requires elevated administrative rights (`auth.admin.deleteUser`).
* To uphold zero-secret exposure on the client, Shelf's frontend calls the Edge Function using the user's ephemeral JWT bearer token (`supabase.functions.invoke('delete-account', { method: 'POST' })`).
* The Edge Function verifies caller identity via `auth.getUser()`, and only deletes the user record corresponding to the authenticated caller.
* Database cascades (`ON DELETE CASCADE` on `auth.users`) automatically delete all user collections, tags, bookmarks, and tag joins in PostgreSQL.

### 2. Environment Variables & Remote Secrets
The Edge Function requires these secrets configured in Supabase (Project Settings > Edge Functions > Secrets):

| Secret Name | Injected By | Description |
| :--- | :---: | :--- |
| `SUPABASE_URL` | Supabase Runtime | Project URL |
| `SUPABASE_ANON_KEY` | Supabase Runtime | Public anon key for JWT verification |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Runtime | Server-side master key for `auth.admin.deleteUser` |
| `APP_ORIGIN` | User / Administrator | Production domain URL for CORS policy (e.g. `https://shelf.app`) |

### 3. Future Deployment Procedure (CLI)
When release authorization is granted, execute via the Supabase CLI:
```bash
# 1. Login to Supabase CLI
npx supabase login

# 2. Link repository to the target project
npx supabase link --project-ref <your-production-ref>

# 3. Configure the production origin secret
npx supabase secrets set APP_ORIGIN=https://<your-production-domain>

# 4. Deploy the function (disabling client-side JWT verification because the function handles it internally)
npx supabase functions deploy delete-account --no-verify-jwt
```

### 4. Post-Deployment Smoke Test
1. Create a disposable test account in the deployment (e.g. `test-deletion@example.com`).
2. Add a test collection, tag, and bookmark.
3. Open **Settings > Danger Zone** and click **Delete Account**.
4. Confirm modal warning.
5. Verify client signs out, tokens are purged from browser storage, and navigating back requires authentication.
6. Check Supabase Dashboard to confirm user `auth.users` row and associated public tables are purged.

---

## Section F — Hosting & Routing Architecture

### 1. Hash-Based Navigation Mechanics
Shelf routes using URL hash fragments ([src/App.tsx#L37-L67](file:///C:/Users/Admin/shelf/src/App.tsx#L37-L67)):
* `/#/` → Home view
* `/#/all` → All Bookmarks
* `/#/favourites` → Favourites
* `/#/collections` → Collections overview
* `/#/collections/:id` → Collection detail view
* `/#/tags` → Tags overview
* `/#/tags/:id` → Tag detail view
* `/#/settings` → Settings

### 2. SPA Fallback Analysis
* **Why hash routing simplifies hosting:** In hash navigation, the browser **never** sends the hash fragment (`#/...`) to the web server. When a user requests `https://shelf.app/#/collections/col_123`, the HTTP request sent to the server is strictly `GET / HTTP/1.1`.
* Consequently, static hosts (e.g. AWS S3, GitHub Pages, Apache, Nginx) serve `index.html` natively without requiring server-side rewrite engines.
* **When an SPA Fallback is still recommended:** If an end user or browser extension navigates to `https://shelf.app/settings` (accidentally omitting the `#`), a server without a catch-all rewrite will return HTTP 404.
* **Hosting Decision Status:** Because Shelf has not been assigned a specific hosting platform (e.g. Cloudflare Pages vs. Vercel vs. Netlify vs. S3), no provider-specific config file (`vercel.json`, `_redirects`, `netlify.toml`) is imposed.
* For reference, standard provider rewrites when selecting a host:
  * **Netlify (`public/_redirects`):** `/*    /index.html   200`
  * **Vercel (`vercel.json`):** `{"rewrites": [{"source": "/(.*)", "destination": "/index.html"}]}`
  * **Nginx:** `try_files $uri $uri/ /index.html;`

### 3. Production Build Artifacts
Running `npm run build` produces the static assets in `dist/`:
* `dist/index.html` (Application shell)
* `dist/assets/index-*.css` (Compiled Tailwind CSS)
* `dist/assets/vendor-react-*.js` (React, React-DOM)
* `dist/assets/vendor-supabase-*.js` (@supabase/supabase-js)
* `dist/assets/index-*.js` (App shell, layout, contexts)
* `dist/assets/*Page-*.js` (Lazy route chunks loaded on demand)

---

## Section G — Release Smoke-Test Checklist

Perform this manual testing checklist against the release staging build before promoting to production:

- [ ] **1. Initial Application Load**
  * Load root URL `/#/`.
  * Verify loading screen ("Opening Shelf... Verifying security session") displays briefly without flickering.
  * Verify unauthenticated user lands on `AuthPage` ("Sign In").
- [ ] **2. Account Registration & Confirmation**
  * Register a new account with email + password.
  * Verify confirmation notice appears.
  * Click verification email link; verify redirect back to application with established session.
- [ ] **3. Login & Logout**
  * Sign out via sidebar/settings; verify immediate return to `AuthPage`.
  * Sign in with valid credentials; verify transition to `HomePage`.
  * Test invalid password; verify clean inline error without unhandled exception.
- [ ] **4. Password Recovery**
  * Click "Forgot Password", enter email, click dispatch.
  * Click recovery link in email; verify application enters `isPasswordRecovery` mode.
  * Enter new password; verify update succeeds and unlocks authenticated shell.
- [ ] **5. Bookmark Curation (CRUD)**
  * Quick Add: Click "+", enter valid URL, assign title, notes, and tags. Click Save.
  * Verify bookmark appears in Home and All Bookmarks immediately.
  * Edit Bookmark: Update title, notes, and collection assignment. Verify update reflects across all views.
  * Duplicate Guard: Attempt to add the same URL again; verify duplicate warning notice.
  * Delete Bookmark: Delete bookmark via action menu; confirm permanent deletion modal; verify complete removal from library and decrementing counts.
- [ ] **6. Collections & Tags**
  * Create a collection with description and color.
  * Create tags with emoji or symbols (e.g. `#🏷️-design`).
  * Verify collection card and tag badge counts match assigned bookmarks.
  * Delete a collection; verify assigned bookmarks are not deleted (only `collectionId` is unassigned).
  * Delete a tag; verify tag is removed from assigned bookmarks without deleting bookmarks.
- [ ] **7. Navigation & Refresh Persistence**
  * Navigate to a collection detail page (`/#/collections/:id`).
  * Perform a hard browser refresh (`Ctrl+F5` / `Cmd+Shift+R`).
  * Verify detail view reloads correctly with identical collection data.
  * Repeat test for a tag detail page (`/#/tags/:id`).
  * Use browser Back and Forward buttons; verify history traversal updates view state accurately.
- [ ] **8. Multi-Tab Behavior**
  * Open Shelf in Tab A and Tab B.
  * In Tab A, add a bookmark.
  * In Tab B, verify that ordinary navigation or refreshing reflects the new bookmark (confirming no broken cache state).
- [ ] **9. Settings & Architecture Status**
  * Open `/#/settings`.
  * Verify "Backend Architecture & Persistence Status" displays "Authenticated Cloud Persistence Live".
  * Verify badges indicate "Cloud Persistence: Operational", "Authentication: Operational", and "Row-Level Security: Enforced".

---

## Section H — Rollback & Troubleshooting Runbook

### 1. Build Failures
* **Symptom:** `tsc -b` reports type errors or `vite build` fails during Rollup bundling.
* **Resolution:** Run `npm run test` and `npx tsc -b` locally. Inspect imported module paths and ensure no circular dependencies exist between contexts.

### 2. Missing or Invalid Environment Variables
* **Symptom:** Console displays `[Shelf / Supabase] Configuration Notice: Missing required Supabase configuration...` and `AuthPage` rejects actions with `"Supabase is not configured"`.
* **Resolution:** Verify that `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured in your hosting environment settings. Re-trigger a deployment build after updating variables (Vite bakes them at build time).

### 3. Authentication Redirect Errors
* **Symptom:** User clicks verification or recovery link and receives `error=redirect_uri_not_allowed` or lands on a 404 page.
* **Resolution:** Open Supabase Dashboard > Authentication > URL Configuration. Add the exact production origin and redirect path (`https://<domain>/#/**`) to the **Redirect URLs** list.

### 4. Database Migration & RLS Errors
* **Symptom:** Console reports `new row violates row-level security policy` or `permission denied for table ...`.
* **Resolution:**
  1. Confirm user is authenticated (`auth.uid()` is non-null).
  2. Confirm migration `20261118_stage5_cloud_persistence.sql` was applied completely.
  3. Verify that `GRANT SELECT, INSERT, UPDATE, DELETE ON ... TO authenticated;` was executed.
  4. Ensure `save_bookmark_with_tags` has `GRANT EXECUTE TO authenticated;`.

### 5. Edge Function Invocations Fail
* **Symptom:** Delete account returns `500 Server configuration error` or `403 Origin not allowed`.
* **Resolution:**
  1. Check Supabase Edge Function logs in Dashboard.
  2. Verify that secret `APP_ORIGIN` matches the client website's origin (e.g. `https://shelf.app`).
  3. Ensure `SUPABASE_SERVICE_ROLE_KEY` is present in the project secrets.

### 6. Emergency Rollback Procedure
If a production deployment exhibits critical regressions:
1. **Frontend Rollback:** In your hosting provider dashboard (Cloudflare / Vercel / Netlify), rollback to the previous immutable deployment commit with 1-click redeploy.
2. **Database State:** Because `20261118_stage5_cloud_persistence.sql` establishes non-destructive tables (`IF NOT EXISTS`), rolling back the frontend build to an earlier Stage 5 commit will continue reading from the established PostgreSQL tables without data loss.

---

*End of Stage 6 Release & Deployment Readiness Guide.*
