import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bright Data API configuration
const BRIGHTDATA_API_URL = 'https://api.brightdata.com/datasets/v3/scrape';
const INSTAGRAM_PROFILES_DATASET_ID = 'gd_l1vikfch901nx3by4';

// Proxy de imagem para HTTPS
const proxyImage = (url: string | undefined | null): string => {
  if (!url) return '';
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=200&h=200&fit=cover`;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username } = await req.json();

    if (!username) {
      return new Response(
        JSON.stringify({ success: false, error: "Username is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean username
    const cleanUsername = username
      .replace('@', '')
      .replace('https://instagram.com/', '')
      .replace('https://www.instagram.com/', '')
      .replace('/', '')
      .trim()
      .toLowerCase();

    console.log(`Syncing profile via Bright Data: ${cleanUsername}`);

    const BRIGHTDATA_TOKEN = Deno.env.get('BRIGHTDATA_API_TOKEN');
    
    if (!BRIGHTDATA_TOKEN) {
      console.error('BRIGHTDATA_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Token da Bright Data não configurado", 
          username: cleanUsername 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const profileUrl = `https://www.instagram.com/${cleanUsername}/`;
      console.log('Calling Bright Data API for sync:', profileUrl);
      
      const response = await fetch(`${BRIGHTDATA_API_URL}?dataset_id=${INSTAGRAM_PROFILES_DATASET_ID}&format=json`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BRIGHTDATA_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: [{ url: profileUrl }]
        })
      });

      console.log('Bright Data API status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Bright Data sync response:', JSON.stringify(data).substring(0, 1500));
        
        // Response can be an array of profiles
        const profileData = Array.isArray(data) ? data[0] : data;
        
        if (profileData && (profileData.followers || profileData.id)) {
          // Profile picture with HTTPS proxy
          const proxiedProfilePic = profileData.profile_image_link 
            ? proxyImage(profileData.profile_image_link)
            : `https://api.dicebear.com/7.x/initials/svg?seed=${cleanUsername}&backgroundColor=10b981`;

          const profile = {
            username: profileData.account || profileData.profile_name || cleanUsername,
            followers: profileData.followers || 0,
            following: profileData.following || 0,
            posts: profileData.posts_count || profileData.post_count || 0,
            profilePicUrl: proxiedProfilePic,
            fullName: profileData.profile_name || profileData.full_name || cleanUsername,
            bio: profileData.biography || profileData.bio || "",
            externalUrl: profileData.external_url || ""
          };

          console.log(`✅ Profile ${cleanUsername} synced: ${profile.followers} followers`);

          return new Response(
            JSON.stringify({ success: true, profile }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          console.log(`❌ Profile ${cleanUsername} not found in API response`);
        }
      } else if (response.status === 202) {
        // Async request - need to wait
        const data = await response.json();
        console.log('Bright Data returned 202 (async processing):', data);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Perfil está sendo processado, tente novamente em alguns segundos", 
            username: cleanUsername,
            processing: true
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const errorText = await response.text();
        console.log(`❌ Bright Data API error for ${cleanUsername}:`, response.status, errorText.substring(0, 500));
      }
    } catch (apiError) {
      console.error(`API error for ${cleanUsername}:`, apiError);
    }

    // Profile not found or API error
    console.log(`Profile ${cleanUsername} não existe ou API indisponível`);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Perfil não existe ou API indisponível", 
        username: cleanUsername 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in sync function:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
