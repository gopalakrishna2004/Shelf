# Supabase Edge Function: delete-account

This Edge Function handles secure, server-side deletion of a Shelf user account.

## Security Architecture

1. **Zero Secret Exposure**: The frontend client uses only the public publishable/anon key. The `service_role` key is stored exclusively in Supabase's secure server-side environment secrets.
2. **Caller Identity Verification**: The function reads the incoming JWT from the `Authorization: Bearer <token>` header and calls `supabase.auth.getUser()` to identify the caller. A user can only delete their own account.
3. **HTTP Method Restriction**: Only `POST` (for execution) and `OPTIONS` (for CORS preflight) are permitted. All other methods are rejected with `HTTP 405 Method Not Allowed`.
4. **CORS Hardening**: Requests from unapproved browser origins are rejected with `HTTP 403 Forbidden` and do not receive allowed-origin headers. Permitted origins include:
   - Local development: `http://localhost:5174`
   - Production origin configured via the `APP_ORIGIN` environment variable.
5. **Safe Error Responses**: Operational, database, or stack trace details are logged on the server side via `console.error` and never returned to the caller. The client receives clean, generic error messages.
6. **Data Cascade Ready**: When bookmark and collection tables are created in subsequent stages, cascading deletes or explicit cleanup queries can be executed in this function prior to removing the auth record.

## Required Environment Variables / Secrets

The function validates the following variables before execution:
- `SUPABASE_URL` (injected automatically by Supabase runtime)
- `SUPABASE_ANON_KEY` (injected automatically by Supabase runtime)
- `SUPABASE_SERVICE_ROLE_KEY` (injected automatically by Supabase runtime)
- `APP_ORIGIN` (configured for your production domain, e.g., `https://shelf.app`)

Set `APP_ORIGIN` via the Supabase dashboard (Project Settings > Edge Functions > Secrets) or CLI:
```bash
npx supabase secrets set APP_ORIGIN=https://your-production-domain.com
```

## Deployment Steps

To deploy this Edge Function to your Supabase project:

```bash
# 1. Login to Supabase CLI (if not already logged in)
npx supabase login

# 2. Link your project (<your-project-ref>)
npx supabase link --project-ref <your-project-ref>

# 3. Set the production origin secret
npx supabase secrets set APP_ORIGIN=https://your-production-domain.com

# 4. Deploy the Edge Function
npx supabase functions deploy delete-account --no-verify-jwt
```
