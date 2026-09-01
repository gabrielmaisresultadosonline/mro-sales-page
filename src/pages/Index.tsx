import { useState, useEffect } from 'react';
import { LoginPage } from '@/components/LoginPage';
import { ProfileRegistration } from '@/components/ProfileRegistration';
import { Dashboard } from '@/components/Dashboard';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { MROSession, ProfileSession, InstagramProfile, ProfileAnalysis } from '@/types/instagram';
import {
  getSession, 
  saveSession, 
  hasExistingSession, 
  createEmptySession,
  addProfile,
  setActiveProfile,
  removeProfile,
  getActiveProfile,
  cleanExpiredCreatives,
  cleanExpiredStrategies,
  setCloudSyncCallback,
  initializeFromCloud
} from '@/lib/storage';
import { 
  isAuthenticated, 
  getRegisteredIGs,
  isIGRegistered,
  addRegisteredIG,
  getCurrentUser,
  logoutUser,
  saveUserToCloud,
  getUserSession
} from '@/lib/userStorage';
import { fetchInstagramProfile, analyzeProfile } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { 
  loadPersistedDataOnLogin, 
  syncSessionToPersistent,
  hasPersistedProfileData,
  getPersistedProfile,
  persistProfileData,
  shouldFetchProfile,
  syncPersistentToSession
} from '@/lib/persistentStorage';

const Index = () => {
  const [session, setSession] = useState<MROSession>(createEmptySession());
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingSubMessage, setLoadingSubMessage] = useState('');
  const [showDashboard, setShowDashboard] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasRegisteredProfiles, setHasRegisteredProfiles] = useState(false);
  const { toast } = useToast();

  // Get current logged in username
  const getLoggedInUsername = (): string => {
    const user = getCurrentUser();
    return user?.username || 'anonymous';
  };

  // Set up cloud sync callback on mount (critical for strategies/creatives persistence)
  useEffect(() => {
    setCloudSyncCallback(saveUserToCloud);
  }, []);

  // Check auth status on mount and load persisted data
  useEffect(() => {
    const initializeFromCloudData = async () => {
      try {
        const authenticated = isAuthenticated();
        setIsLoggedIn(authenticated);
        
        if (authenticated) {
          const registeredIGs = getRegisteredIGs();
          const igUsernames = registeredIGs.map(ig => ig.username);
          setHasRegisteredProfiles(registeredIGs.length > 0);
          
          // CRITICAL: First try to load from cloud storage (user_sessions table)
          const userSession = getUserSession();
          const cloudProfiles = userSession.cloudData?.profileSessions || [];
          const cloudArchived = userSession.cloudData?.archivedProfiles || [];
          
          console.log(`🔐 Auth check: ${registeredIGs.length} registered IGs, ${cloudProfiles.length} cloud profiles`);
          
          if (cloudProfiles.length > 0) {
            // Initialize from cloud data - NO external API calls needed!
            console.log(`☁️ Inicializando ${cloudProfiles.length} perfis da nuvem...`);
            initializeFromCloud(cloudProfiles, cloudArchived);
            
            // Clean expired data
            cleanExpiredCreatives();
            cleanExpiredStrategies();
            
            const existingSession = getSession();
            setSession(existingSession);
            
            if (existingSession.profiles.length > 0) {
              setShowDashboard(true);
              toast({
                title: `${existingSession.profiles.length} perfil(is) carregado(s)`,
                description: 'Dados restaurados da nuvem'
              });
            }
          } else if (igUsernames.length > 0) {
            // No cloud data but has registered profiles - AUTO SYNC!
            console.log(`🔄 Auto-sincronizando ${igUsernames.length} perfis na inicialização...`);
            setIsLoading(true);
            setLoadingMessage('Sincronizando perfis...');
            setLoadingSubMessage(`Carregando ${igUsernames.length} perfis. Isso pode levar alguns minutos.`);
            
            // Trigger auto-sync
            await handleSyncComplete(igUsernames);
          } else {
            // No profiles at all
            const existingSession = getSession();
            setSession(existingSession);
            
            if (existingSession.profiles.length > 0) {
              setShowDashboard(true);
            }
          }
        }
      } catch (error) {
        console.error('[Index] Error in auth check:', error);
        setIsLoggedIn(false);
      }
    };
    
    initializeFromCloudData();
  }, []);

  const handleLoginSuccess = async () => {
    setIsLoggedIn(true);
    setIsLoading(true);
    setLoadingMessage('Carregando seus dados...');
    setLoadingSubMessage('Buscando dados salvos na nuvem.');
    
    try {
      const registeredIGs = getRegisteredIGs();
      const igUsernames = registeredIGs.map(ig => ig.username);
      setHasRegisteredProfiles(registeredIGs.length > 0);
      
      // CRITICAL: Load from cloud storage first (user_sessions table)
      const userSession = getUserSession();
      const cloudProfiles = userSession.cloudData?.profileSessions || [];
      const cloudArchived = userSession.cloudData?.archivedProfiles || [];
      
      console.log(`🔐 Login: ${registeredIGs.length} IGs registrados, ${cloudProfiles.length} perfis na nuvem`);
      
      if (cloudProfiles.length > 0) {
        // Initialize from cloud data - NO external API calls needed!
        console.log(`☁️ Restaurando ${cloudProfiles.length} perfis da nuvem...`);
        initializeFromCloud(cloudProfiles, cloudArchived);
        
        const existingSession = getSession();
        setSession(existingSession);
        
        if (existingSession.profiles.length > 0) {
          setShowDashboard(true);
          toast({
            title: `${existingSession.profiles.length} perfil(is) restaurado(s)`,
            description: 'Dados carregados da nuvem com sucesso'
          });
        }
        setIsLoading(false);
      } else if (igUsernames.length > 0) {
        // No cloud data but has registered profiles - AUTO SYNC!
        console.log(`🔄 Auto-sincronizando ${igUsernames.length} perfis...`);
        setLoadingMessage('Sincronizando perfis...');
        setLoadingSubMessage(`Carregando ${igUsernames.length} perfis. Isso pode levar alguns minutos.`);
        
        // Auto sync in background - don't wait, but trigger it
        setIsLoading(false);
        
        // Trigger auto-sync after a small delay
        setTimeout(() => {
          handleSyncComplete(igUsernames);
        }, 500);
      } else {
        // No profiles at all
        const existingSession = getSession();
        setSession(existingSession);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[Index] Error in handleLoginSuccess:', error);
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setIsLoggedIn(false);
    setShowDashboard(false);
    setHasRegisteredProfiles(false);
    setSession(createEmptySession());
  };

  const handleProfileRegistered = async (profile: InstagramProfile, analysis: ProfileAnalysis) => {
    const loggedInUsername = getLoggedInUsername();
    
    // Add profile to session
    addProfile(profile, analysis);
    
    // PERSIST DATA PERMANENTLY TO SERVER
    await persistProfileData(loggedInUsername, profile.username, profile, analysis);
    
    // Get updated session
    const updatedSession = getSession();
    setSession(updatedSession);
    setShowDashboard(true);
    setHasRegisteredProfiles(true);

    // Sync to server
    await syncSessionToPersistent(loggedInUsername);

    toast({
      title: "Perfil cadastrado! ✨",
      description: `@${profile.username} está pronto para usar.`,
    });
  };

  const handleSyncComplete = async (instagrams: string[]) => {
    setIsLoading(true);
    setLoadingMessage('Sincronizando perfis...');
    setLoadingSubMessage('Buscando dados do Instagram. Isso pode levar até 5 minutos.');
    const user = getCurrentUser();
    const loggedInUsername = getLoggedInUsername();
    let loadedCount = 0;
    let cachedCount = 0;
    
    for (const ig of instagrams) {
      setLoadingMessage(`Buscando @${ig}...`);
      const normalizedIg = ig.toLowerCase();
      
      // Check if already in session
      const existingProfile = session.profiles.find(
        p => p.profile.username.toLowerCase() === normalizedIg
      );
      
      if (existingProfile) {
        console.log(`⏭️ @${ig} já está na sessão`);
        continue;
      }
      
      // CHECK SERVER STORAGE FIRST - avoid unnecessary API calls
      const { shouldFetch, reason } = shouldFetchProfile(normalizedIg);
      const persistedData = getPersistedProfile(normalizedIg);
      
      if (persistedData && !shouldFetch) {
        // USE CACHED DATA - no API call needed
        console.log(`📦 Usando dados do servidor para @${ig}: ${reason}`);
        addProfile(persistedData.profile, persistedData.analysis);
        cachedCount++;
        
        toast({
          title: `@${ig} carregado`,
          description: reason
        });
        continue;
      }
      
      // Only fetch from API if needed
      try {
        toast({
          title: `Buscando @${ig}...`,
          description: shouldFetch ? reason : 'Buscando dados atualizados'
        });
        
        const profileResult = await fetchInstagramProfile(ig);
        
        if (profileResult.success && profileResult.profile) {
          const analysisResult = await analyzeProfile(profileResult.profile);
          
          if (analysisResult.success && analysisResult.analysis) {
            addProfile(profileResult.profile, analysisResult.analysis);
            
            // PERSIST DATA PERMANENTLY TO SERVER
            await persistProfileData(loggedInUsername, ig, profileResult.profile, analysisResult.analysis);
            loadedCount++;
            
            // Mark as registered if not already
            if (user?.email && !isIGRegistered(ig)) {
              addRegisteredIG(ig, user.email, true);
            }
          }
        }
      } catch (error) {
        console.error(`Error loading ${ig}:`, error);
        
        // Try to use cached data as fallback
        if (persistedData) {
          console.log(`⚠️ Erro na API, usando cache para @${ig}`);
          addProfile(persistedData.profile, persistedData.analysis);
          cachedCount++;
        }
      }
    }

    const updatedSession = getSession();
    setSession(updatedSession);
    
    // Sync all to server
    await syncSessionToPersistent(loggedInUsername);
    
    if (updatedSession.profiles.length > 0) {
      setShowDashboard(true);
      setHasRegisteredProfiles(true);
    }
    
    setIsLoading(false);
    
    toast({
      title: 'Sincronização concluída!',
      description: `${loadedCount} buscado(s) da API, ${cachedCount} do servidor`
    });
  };

  const handleSearch = async (username: string) => {
    // Check if IG is registered
    if (!isIGRegistered(username)) {
      toast({
        title: 'Perfil não cadastrado',
        description: 'Cadastre este perfil primeiro antes de analisar',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    setLoadingMessage(`Buscando @${username.replace('@', '')}...`);
    setLoadingSubMessage('Analisando perfil com I.A. Isso pode levar até 5 minutos.');

    try {
      toast({
        title: "Buscando perfil...",
        description: `Analisando @${username.replace('@', '')}`,
      });

      const profileResult = await fetchInstagramProfile(username);

      if (!profileResult.success || !profileResult.profile) {
        toast({
          title: "Erro ao buscar perfil",
          description: profileResult.error || "Tente novamente",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const profile = profileResult.profile;

      toast({
        title: "Analisando com IA...",
        description: "Gerando insights personalizados",
      });

      const analysisResult = await analyzeProfile(profile);

      if (!analysisResult.success || !analysisResult.analysis) {
        toast({
          title: "Erro na análise",
          description: analysisResult.error || "Usando análise básica",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      addProfile(profile, analysisResult.analysis);
      
      const updatedSession = getSession();
      setSession(updatedSession);
      setShowDashboard(true);

      toast({
        title: "Análise concluída! ✨",
        description: `Perfil @${profile.username} analisado com sucesso.`,
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Erro na análise",
        description: "Não foi possível analisar o perfil. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewProfile = async (username: string) => {
    await handleSearch(username);
  };

  const handleSelectProfile = (profileId: string) => {
    setActiveProfile(profileId);
    const updatedSession = getSession();
    setSession(updatedSession);
  };

  const handleRemoveProfile = (profileId: string) => {
    removeProfile(profileId);
    const updatedSession = getSession();
    setSession(updatedSession);
    
    if (updatedSession.profiles.length === 0) {
      setShowDashboard(false);
    }
  };

  const handleSessionUpdate = async (updatedSession: MROSession) => {
    setSession(updatedSession);
    saveSession(updatedSession);
    
    // Sync to server on every update
    const loggedInUsername = getLoggedInUsername();
    await syncSessionToPersistent(loggedInUsername);
  };

  const handleReset = () => {
    setSession(createEmptySession());
    setShowDashboard(false);
    toast({
      title: "Sessão resetada",
      description: "Todas as informações foram apagadas.",
    });
  };

  const handleNavigateToRegister = () => {
    setShowDashboard(false);
  };

  // Not logged in - show login page
  if (!isLoggedIn) {
    return (
      <>
        <LoadingOverlay isVisible={isLoading} message={loadingMessage} subMessage={loadingSubMessage} />
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  // Logged in but no registered profiles - show registration
  if (!hasRegisteredProfiles || !showDashboard) {
    return (
      <>
        <LoadingOverlay isVisible={isLoading} message={loadingMessage} subMessage={loadingSubMessage} />
        <ProfileRegistration 
          onProfileRegistered={handleProfileRegistered}
          onSyncComplete={handleSyncComplete}
          onLogout={handleLogout}
        />
      </>
    );
  }

  // Show dashboard
  if (showDashboard && session.profiles.length > 0) {
    return (
      <>
        <LoadingOverlay isVisible={isLoading} message={loadingMessage} subMessage={loadingSubMessage} />
        <Dashboard 
          session={session} 
          onSessionUpdate={handleSessionUpdate}
          onReset={handleReset}
          onAddProfile={handleAddNewProfile}
          onSelectProfile={handleSelectProfile}
          onRemoveProfile={handleRemoveProfile}
          onNavigateToRegister={handleNavigateToRegister}
          isLoading={isLoading}
          onLogout={handleLogout}
        />
      </>
    );
  }

  // Fallback to registration
  return (
    <>
      <LoadingOverlay isVisible={isLoading} message={loadingMessage} subMessage={loadingSubMessage} />
      <ProfileRegistration 
        onProfileRegistered={handleProfileRegistered}
        onSyncComplete={handleSyncComplete}
        onLogout={handleLogout}
      />
    </>
  );
};

export default Index;
