import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'http://localhost:5174',
  Deno.env.get('APP_ORIGIN') ?? '',
].filter(Boolean);

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Vary': 'Origin',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] =
      'authorization, x-client-info, apikey, content-type';
  }
  return headers;
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const isOriginAllowed = !origin || ALLOWED_ORIGINS.includes(origin);

  // 1. Enforce CORS origin policy for browser requests
  if (origin && !isOriginAllowed) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed.' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Vary': 'Origin',
        },
      }
    );
  }

  const corsHeaders = getCorsHeaders(origin);

  // 2. Handle CORS preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    });
  }

  // 3. Reject non-POST HTTP methods with 405 Method Not Allowed
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed.' }),
      {
        status: 405,
        headers: {
          'Allow': 'POST, OPTIONS',
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  try {
    // 4. Validate presence of caller's Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header.' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // 5. Validate required environment configuration
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('[delete-account] Server configuration error: Missing required environment variables', {
        hasUrl: Boolean(supabaseUrl),
        hasAnonKey: Boolean(supabaseAnonKey),
        hasServiceRoleKey: Boolean(supabaseServiceKey),
      });
      return new Response(
        JSON.stringify({ error: 'Server configuration error.' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // 6. Verify caller identity using their JWT and the anon client
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error('[delete-account] Unauthorized request:', userError?.message || 'No user found');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired session.' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // 7. Initialize admin client with service_role key strictly on the server
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 8. (Reserved for future stages: user bookmark & collection data cascade)

    // 9. Permanently delete the user auth record derived strictly from verified caller
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('[delete-account] Auth admin deleteUser failed for user:', user.id, deleteError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to delete account. Please try again later.' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account permanently deleted.' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (err: any) {
    console.error('[delete-account] Unexpected operational error:', err?.message || err);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred while deleting your account.' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});
