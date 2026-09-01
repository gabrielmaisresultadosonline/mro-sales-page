import { supabase } from '@/integrations/supabase/client';
import { InstagramProfile, ProfileAnalysis, Strategy, Creative, CreativeConfig } from '@/types/instagram';
import { 
  getCachedProfileData, 
  convertCachedToInstagramProfile, 
  updateCachedProfile 
} from '@/lib/syncStorage';

export const fetchInstagramProfile = async (
  username: string,
  existingPosts?: any[],
  forceRefresh: boolean = false
): Promise<{
  success: boolean;
  profile?: InstagramProfile;
  simulated?: boolean;
  message?: string;
  error?: string;
  fromCache?: boolean;
}> => {
  try {
    const normalizedUsername = username.toLowerCase().replace('@', '');
    
    // STEP 1: Check cached data from server (admin synced profiles)
    if (!forceRefresh) {
      const cacheResult = getCachedProfileData(normalizedUsername);
      
      if (cacheResult.isCached && cacheResult.isRecent && cacheResult.cachedProfile) {
        console.log(`🚀 Usando dados em cache para @${normalizedUsername} (${cacheResult.daysSinceLastUpdate} dias atrás)`);
        
        // Profile data is recent (< 7 days), use cached version
        // But we still need to fetch recent posts since cached profiles don't store them
        const cachedProfile = convertCachedToInstagramProfile(cacheResult.cachedProfile);
        
        // Fetch ONLY recent posts from API (saves bandwidth)
        console.log(`📸 Buscando apenas posts recentes para @${normalizedUsername}...`);
        const { data: postsData, error: postsError } = await supabase.functions.invoke('fetch-instagram', {
          body: { username: normalizedUsername, onlyPosts: true }
        });
        
        if (!postsError && postsData?.success && postsData?.profile?.recentPosts) {
          cachedProfile.recentPosts = postsData.profile.recentPosts;
          cachedProfile.avgLikes = postsData.profile.avgLikes || 0;
          cachedProfile.avgComments = postsData.profile.avgComments || 0;
          cachedProfile.engagement = postsData.profile.engagement || 
            (cachedProfile.followers > 0 ? (cachedProfile.avgLikes / cachedProfile.followers) * 100 : 0);
        }
        
        return {
          success: true,
          profile: cachedProfile,
          simulated: false,
          fromCache: true,
          message: `Dados em cache (${cacheResult.daysSinceLastUpdate} dias atrás) + posts atualizados`
        };
      }
      
      // If cached but stale (> 7 days), log and proceed to fetch fresh data
      if (cacheResult.isCached && !cacheResult.isRecent) {
        console.log(`⏰ Cache expirado para @${normalizedUsername} (${cacheResult.daysSinceLastUpdate} dias) - buscando dados novos`);
      }
    }
    
    // STEP 2: Fetch fresh data from API
    console.log(`🌐 Buscando dados completos da API para @${normalizedUsername}...`);
    const { data, error } = await supabase.functions.invoke('fetch-instagram', {
      body: { username: normalizedUsername, existingPosts }
    });

    if (error) {
      console.error('Error fetching profile:', error);
      return { success: false, error: error.message };
    }

    // Check for API error response
    if (!data.success) {
      return { 
        success: false, 
        error: data.error || 'Não foi possível buscar o perfil'
      };
    }

    if (data.profile) {
      // Use ONLY real data from the API - no fallbacks to mock data
      const profile: InstagramProfile = {
        ...data.profile,
        engagement: data.profile.engagement || (data.profile.followers > 0 
          ? ((data.profile.avgLikes || 0) / data.profile.followers) * 100 
          : 0),
        avgLikes: data.profile.avgLikes || 0,
        avgComments: data.profile.avgComments || 0,
        recentPosts: data.profile.recentPosts || [], // Empty array if no real posts, NOT mock
      };
      
      // Update cache with fresh data
      updateCachedProfile(normalizedUsername, {
        followers: profile.followers,
        following: profile.following,
        posts: profile.posts,
        profilePicUrl: profile.profilePicUrl,
        fullName: profile.fullName,
        bio: profile.bio
      });

      return { 
        success: true, 
        profile,
        simulated: false,
        fromCache: false,
        message: data.message
      };
    }

    return { success: false, error: 'Não foi possível buscar o perfil' };
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: 'Erro de conexão' };
  }
};

export const analyzeProfile = async (profile: InstagramProfile): Promise<{
  success: boolean;
  analysis?: ProfileAnalysis;
  error?: string;
}> => {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-profile', {
      body: { profile }
    });

    if (error) {
      console.error('Error analyzing profile:', error);
      return { success: false, error: error.message };
    }

    if (data.success && data.analysis) {
      return { success: true, analysis: data.analysis };
    }

    return { success: false, error: 'Não foi possível analisar o perfil' };
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: 'Erro de conexão' };
  }
};

export const generateStrategy = async (
  profile: InstagramProfile, 
  analysis: ProfileAnalysis, 
  type: 'mro' | 'content' | 'engagement' | 'sales' | 'bio'
): Promise<{
  success: boolean;
  strategy?: Strategy;
  error?: string;
}> => {
  try {
    const { data, error } = await supabase.functions.invoke('generate-strategy', {
      body: { profile, analysis, type }
    });

    if (error) {
      console.error('Error generating strategy:', error);
      return { success: false, error: error.message };
    }

    if (data.success && data.strategy) {
      return { success: true, strategy: data.strategy };
    }

    return { success: false, error: 'Não foi possível gerar a estratégia' };
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: 'Erro de conexão' };
  }
};

export const generateCreative = async (
  strategy: Strategy,
  profile: InstagramProfile,
  niche: string,
  config?: CreativeConfig,
  logoUrl?: string,
  isManualMode?: boolean,
  customPrompt?: string,
  personPhotoBase64?: string,
  includeText?: boolean,
  includeLogo?: boolean
): Promise<{
  success: boolean;
  creative?: Creative;
  error?: string;
}> => {
  try {
    const { data, error } = await supabase.functions.invoke('generate-creative', {
      body: { 
        strategy, 
        profile, 
        niche,
        config,
        logoUrl: includeLogo === false ? null : logoUrl,
        isManualMode,
        customPrompt,
        personPhotoBase64,
        includeText,
        includeLogo,
        variationSeed: Date.now() + Math.floor(Math.random() * 10000) // Ensure uniqueness
      }
    });

    if (error) {
      console.error('Error generating creative:', error);
      return { success: false, error: error.message };
    }

    if (data.success && data.creative) {
      return { success: true, creative: data.creative };
    }

    return { success: false, error: 'Não foi possível gerar o criativo' };
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: 'Erro de conexão' };
  }
};

// Generate auth token for secure API calls
const generateCreativeAuthToken = (username: string): string => {
  const tokenKey = `mro_creative_auth_${username.toLowerCase()}`;
  let token = sessionStorage.getItem(tokenKey);
  if (!token) {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 15);
    token = `${username.toLowerCase()}_${timestamp}_${randomPart}`;
    sessionStorage.setItem(tokenKey, token);
  }
  return token;
};

// Upload creative image to storage and get permanent URL
export const uploadCreativeImage = async (
  username: string,
  creativeId: string,
  imageBase64: string
): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> => {
  try {
    const auth_token = generateCreativeAuthToken(username);
    
    const { data, error } = await supabase.functions.invoke('upload-creative', {
      body: { 
        action: 'upload',
        username, 
        creativeId, 
        imageBase64,
        auth_token
      }
    });

    if (error) {
      console.error('Error uploading creative:', error);
      return { success: false, error: error.message };
    }

    if (data.success && data.url) {
      return { success: true, url: data.url };
    }

    return { success: false, error: data.error || 'Erro ao fazer upload' };
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: 'Erro de conexão' };
  }
};

// Delete creative from storage
export const deleteCreativeImage = async (
  username: string,
  creativeId: string
): Promise<boolean> => {
  try {
    const auth_token = generateCreativeAuthToken(username);
    
    await supabase.functions.invoke('upload-creative', {
      body: { 
        action: 'delete',
        username, 
        creativeId,
        auth_token
      }
    });
    return true;
  } catch (error) {
    console.error('Error deleting creative:', error);
    return false;
  }
};
