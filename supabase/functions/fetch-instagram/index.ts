import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bright Data API configuration
const BRIGHTDATA_API_URL = 'https://api.brightdata.com/datasets/v3/scrape';
const INSTAGRAM_PROFILES_DATASET_ID = 'gd_l1vikfch901nx3by4';
const INSTAGRAM_POSTS_DATASET_ID = 'gd_lyclm20il4r5helnj'; // Posts dataset

interface InstagramProfile {
  username: string;
  fullName: string;
  bio: string;
  followers: number;
  following: number;
  posts: number;
  profilePicUrl: string;
  isBusinessAccount: boolean;
  category: string;
  externalUrl: string;
}

interface InstagramPost {
  id: string;
  imageUrl: string;
  caption: string;
  likes: number;
  comments: number;
  timestamp: string;
  hasHumanFace: boolean;
}

// Proxy de imagem para HTTPS
const proxyImage = (url: string | undefined | null): string => {
  if (!url) return '';
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=400&q=80`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, existingPosts, onlyPosts } = await req.json();
    
    if (!username) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    console.log(`Fetching Instagram profile via Bright Data: ${cleanUsername} (onlyPosts: ${onlyPosts || false})`);

    const BRIGHTDATA_TOKEN = Deno.env.get('BRIGHTDATA_API_TOKEN');
    
    if (!BRIGHTDATA_TOKEN) {
      console.error('BRIGHTDATA_API_TOKEN not configured');
      return Response.json({ 
        success: false, 
        error: 'Token da Bright Data não configurado. Configure o token nas configurações.'
      }, { status: 500, headers: corsHeaders });
    }

    try {
      const profileUrl = `https://www.instagram.com/${cleanUsername}/`;
      console.log('Calling Bright Data API for:', profileUrl);
      
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
        console.log('Bright Data response:', JSON.stringify(data).substring(0, 2000));
        
        // Response can be an array of profiles
        const profileData = Array.isArray(data) ? data[0] : data;
        
        if (profileData && (profileData.followers || profileData.id)) {
          // Profile picture with HTTPS proxy - allow profiles without picture (rare but possible)
          const originalProfilePic = profileData.profile_image_link;
          
          // If onlyPosts mode, we don't need profile pic validation
          if (!onlyPosts && !originalProfilePic) {
            console.log('⚠️ No profile picture - loading anyway');
          }
          
          const proxiedProfilePic = originalProfilePic ? proxyImage(originalProfilePic) : '';

          // Calculate engagement from available data - allow 0 followers (new/empty profiles)
          const followersCount = profileData.followers || 0;
          
          // Log but don't block empty profiles - they can grow later
          if (!onlyPosts && followersCount === 0) {
            console.log('⚠️ Profile has 0 followers - loading anyway for growth tracking');
          }
          
          const postsCount = profileData.posts_count || profileData.post_count || 0;
          const avgEngagement = profileData.avg_engagement || 2.5;

          // Try to get real posts from the profile data
          let recentPosts: InstagramPost[] = [];
          
          // Check if profile data includes posts
          if (profileData.posts && Array.isArray(profileData.posts) && profileData.posts.length > 0) {
            console.log('✅ Found real posts in profile data:', profileData.posts.length);
            recentPosts = profileData.posts.slice(0, 6).map((post: any, index: number) => ({
              id: post.id || post.pk || `post_${index}`,
              imageUrl: proxyImage(post.display_url || post.image_url || post.thumbnail_url),
              caption: post.caption || post.description || '',
              likes: post.likes_count || post.like_count || post.likes || 0,
              comments: post.comments_count || post.comment_count || post.comments || 0,
              timestamp: post.taken_at || post.timestamp || post.date_posted || post.datetime || new Date().toISOString(),
              hasHumanFace: post.has_human_face !== undefined ? post.has_human_face : true,
            }));
          }
          // Check if latest_posts is available
          else if (profileData.latest_posts && Array.isArray(profileData.latest_posts) && profileData.latest_posts.length > 0) {
            console.log('✅ Found real latest_posts:', profileData.latest_posts.length);
            recentPosts = profileData.latest_posts.slice(0, 6).map((post: any, index: number) => ({
              id: post.id || post.pk || `post_${index}`,
              imageUrl: proxyImage(post.display_url || post.image_url || post.thumbnail_url || post.image),
              caption: post.caption || post.description || post.text || '',
              likes: post.likes_count || post.like_count || post.likes || 0,
              comments: post.comments_count || post.comment_count || post.comments || 0,
              timestamp: post.taken_at || post.timestamp || post.date_posted || post.datetime || new Date().toISOString(),
              hasHumanFace: post.has_human_face !== undefined ? post.has_human_face : true,
            }));
          }
          // If we have existing posts from previous fetch, keep them
          else if (existingPosts && Array.isArray(existingPosts) && existingPosts.length > 0) {
            console.log('✅ Keeping existing real posts (no new data from API)');
            recentPosts = existingPosts;
          }
          // No posts available - still return profile but with empty posts
          else {
            console.log('⚠️ No posts available in API response');
            recentPosts = [];
          }

          // Calculate engagement metrics
          const avgLikes = Math.round(followersCount * (avgEngagement / 100));
          const avgComments = Math.round(avgLikes * 0.15);

          // If onlyPosts mode, return minimal response with just posts
          if (onlyPosts) {
            console.log('✅ onlyPosts mode - returning just posts data:', recentPosts.length, 'posts');
            return Response.json({
              success: true,
              profile: {
                recentPosts,
                avgLikes,
                avgComments,
                engagement: Math.min(avgEngagement, 15),
              },
              simulated: false,
              message: 'Posts atualizados via Bright Data API'
            }, { headers: corsHeaders });
          }

          const profile: InstagramProfile = {
            username: profileData.account || profileData.profile_name || cleanUsername,
            fullName: profileData.profile_name || profileData.full_name || '',
            bio: profileData.biography || profileData.bio || '',
            followers: followersCount,
            following: profileData.following || 0,
            posts: postsCount,
            profilePicUrl: proxiedProfilePic,
            isBusinessAccount: profileData.is_business_account || profileData.is_professional_account || false,
            category: profileData.category || '',
            externalUrl: profileData.external_url || '',
          };

          console.log('✅ Profile found via Bright Data:', profile.username, profile.followers, 'posts:', recentPosts.length);

          return Response.json({
            success: true,
            profile: {
              ...profile,
              engagement: Math.min(avgEngagement, 15),
              avgLikes,
              avgComments,
              recentPosts,
            },
            simulated: false,
            message: 'Dados reais do Instagram via Bright Data API'
          }, { headers: corsHeaders });
        } else {
          console.log('❌ No profile data in response');
          return Response.json({ 
            success: false, 
            error: 'Perfil não encontrado. Verifique se o username está correto e se o perfil é público.'
          }, { headers: corsHeaders }); // Return 200 with success: false
        }
      } else if (response.status === 202) {
        // Async request - snapshot being processed
        const data = await response.json();
        console.log('Bright Data returned 202 (async) - data being fetched:', data);
        
        return Response.json({ 
          success: false, 
          error: 'Dados do perfil estão sendo buscados. Aguarde 30 segundos e tente novamente.',
          retryAfter: 30
        }, { status: 202, headers: corsHeaders });
      } else {
        const errorText = await response.text();
        console.log('❌ Bright Data API failed:', response.status, errorText.substring(0, 500));
        
        return Response.json({ 
          success: false, 
          error: `Erro ao buscar perfil (${response.status}). Tente novamente.`
        }, { status: response.status, headers: corsHeaders });
      }
    } catch (e) {
      console.error('Bright Data API error:', e);
      return Response.json({ 
        success: false, 
        error: 'Erro de conexão com a API. Tente novamente.'
      }, { status: 500, headers: corsHeaders });
    }

  } catch (error) {
    console.error('Error fetching Instagram profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return Response.json(
      { success: false, error: 'Erro ao buscar perfil: ' + errorMessage },
      { status: 500, headers: corsHeaders }
    );
  }
});
