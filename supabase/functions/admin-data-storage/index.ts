import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create service client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT token from authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[admin-data-storage] Missing authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - missing token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create a client with the user's token to verify their identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
      console.error('[admin-data-storage] Invalid token:', userError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role using service client and has_role function
    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError) {
      console.error('[admin-data-storage] Error checking admin role:', roleError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Error verifying permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isAdmin) {
      console.error('[admin-data-storage] User is not admin:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden - admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[admin-data-storage] Admin verified:', user.id);

    const { action, data } = await req.json();
    
    // Admin data is stored as a single file
    const filePath = 'admin/sync-data.json';
    console.log(`[admin-data-storage] Action: ${action}`);

    if (action === 'save') {
      // Save admin sync data as JSON file
      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Data is required for save action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const jsonData = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });

      // Upload/update the file using service client
      const { error: uploadError } = await supabaseAdmin.storage
        .from('user-data')
        .upload(filePath, blob, {
          contentType: 'application/json',
          upsert: true
        });

      if (uploadError) {
        console.error('[admin-data-storage] Upload error:', uploadError);
        return new Response(
          JSON.stringify({ success: false, error: uploadError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[admin-data-storage] Admin data saved successfully`);
      return new Response(
        JSON.stringify({ success: true, message: 'Admin data saved successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'load') {
      // Load admin sync data from JSON file using service client
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('user-data')
        .download(filePath);

      if (downloadError) {
        // File doesn't exist yet - return empty data
        if (downloadError.message.includes('not found') || downloadError.message.includes('Object not found')) {
          console.log(`[admin-data-storage] No admin data found`);
          return new Response(
            JSON.stringify({ success: true, data: null, exists: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.error('[admin-data-storage] Download error:', downloadError);
        return new Response(
          JSON.stringify({ success: false, error: downloadError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const text = await fileData.text();
      const adminData = JSON.parse(text);
      
      console.log(`[admin-data-storage] Admin data loaded successfully`);
      return new Response(
        JSON.stringify({ success: true, data: adminData, exists: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid action. Use: save or load' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[admin-data-storage] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
