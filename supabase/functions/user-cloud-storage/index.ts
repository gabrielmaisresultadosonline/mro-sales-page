import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[USER-CLOUD-STORAGE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, username, email, auth_token, daysRemaining, profileSessions, archivedProfiles } = await req.json();
    
    logStep("Request received", { action, username, hasEmail: !!email, hasAuthToken: !!auth_token });

    if (!username) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const normalizedUsername = username.toLowerCase();

    // Authentication required for save and load actions
    if (action === 'save' || action === 'load') {
      if (!auth_token) {
        logStep("Missing auth_token for protected action");
        return new Response(
          JSON.stringify({ success: false, error: 'Authentication required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      // Verify auth_token format: must be username_timestamp_hash format
      const expectedPrefix = `${normalizedUsername}_`;
      if (!auth_token.startsWith(expectedPrefix)) {
        logStep("Invalid auth_token - username mismatch");
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid authentication token' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      // For existing sessions with email, verify the email matches
      const { data: existingSession } = await supabase
        .from('user_sessions')
        .select('id, email')
        .eq('squarecloud_username', normalizedUsername)
        .maybeSingle();

      if (existingSession?.email && email) {
        if (existingSession.email.toLowerCase() !== email.toLowerCase()) {
          logStep("Email mismatch - unauthorized", { stored: '***', provided: '***' });
          return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized: email mismatch' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          );
        }
      }
    }

    // LOAD - Get user data from database
    if (action === 'load') {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('squarecloud_username', normalizedUsername)
        .maybeSingle();

      if (error) {
        logStep('Error loading user data', { error: error.message });
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      if (!data) {
        logStep(`No existing data for user ${normalizedUsername}`);
        return new Response(
          JSON.stringify({ success: true, exists: false, data: null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      logStep(`Loaded data for ${normalizedUsername}`, { 
        profileCount: data.profile_sessions?.length || 0 
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          exists: true, 
          data: {
            email: data.email,
            daysRemaining: data.days_remaining,
            profileSessions: data.profile_sessions || [],
            archivedProfiles: data.archived_profiles || [],
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SAVE - Save/update user data to database
    if (action === 'save') {
      const totalCreatives = (profileSessions || []).reduce((sum: number, p: any) => sum + (p.creatives?.length || 0), 0);
      const totalStrategies = (profileSessions || []).reduce((sum: number, p: any) => sum + (p.strategies?.length || 0), 0);
      logStep(`Saving data`, { 
        username: normalizedUsername,
        profiles: profileSessions?.length || 0, 
        strategies: totalStrategies, 
        creatives: totalCreatives 
      });
      
      // First check if user exists
      const { data: existing } = await supabase
        .from('user_sessions')
        .select('id, email')
        .eq('squarecloud_username', normalizedUsername)
        .maybeSingle();

      const saveData: any = {
        squarecloud_username: normalizedUsername,
        days_remaining: daysRemaining || 365,
        profile_sessions: profileSessions || [],
        archived_profiles: archivedProfiles || [],
      };

      // Only set email if user doesn't exist yet OR has no email set
      if (email && (!existing || !existing.email)) {
        saveData.email = email;
      }

      let result;
      if (existing) {
        const { data, error } = await supabase
          .from('user_sessions')
          .update(saveData)
          .eq('id', existing.id)
          .select()
          .single();
        result = { data, error };
      } else {
        const { data, error } = await supabase
          .from('user_sessions')
          .insert(saveData)
          .select()
          .single();
        result = { data, error };
      }

      if (result.error) {
        logStep('Error saving user data', { error: result.error.message });
        return new Response(
          JSON.stringify({ success: false, error: result.error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      logStep(`Saved data for ${normalizedUsername} successfully`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: {
            email: result.data.email,
            daysRemaining: result.data.days_remaining,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET_EMAIL - Check if email is locked (no auth required - read-only, non-sensitive)
    if (action === 'get_email') {
      const { data } = await supabase
        .from('user_sessions')
        .select('email')
        .eq('squarecloud_username', normalizedUsername)
        .maybeSingle();

      return new Response(
        JSON.stringify({ 
          success: true, 
          email: data?.email || null,
          isLocked: !!data?.email
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    logStep('Error in user-cloud-storage', { error: error instanceof Error ? error.message : 'Unknown' });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
