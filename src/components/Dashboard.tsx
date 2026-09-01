import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MROSession, Strategy, Creative, ProfileSession } from '@/types/instagram';
import { ProfileCard } from './ProfileCard';
import { AnalysisCard } from './AnalysisCard';
import { StrategyGenerator } from './StrategyGenerator';
import { StrategyDisplay } from './StrategyDisplay';
import { CreativeGenerator } from './CreativeGenerator';
import { CreativesGallery } from './CreativesGallery';
import { GrowthTracker } from './GrowthTracker';
import { ProfileSelector } from './ProfileSelector';
import { UserHeader } from './UserHeader';
import { Logo } from './Logo';
import { Button } from '@/components/ui/button';
import { addStrategy, addCreative, resetSession, cleanExpiredCreatives, getSession, saveSession } from '@/lib/storage';
import { syncSessionToPersistent } from '@/lib/persistentStorage';
import { getCurrentUser } from '@/lib/userStorage';
import { 
  RotateCcw, 
  User, 
  BarChart3, 
  Lightbulb, 
  Image as ImageIcon,
  TrendingUp,
  Wrench,
} from 'lucide-react';

interface DashboardProps {
  session: MROSession;
  onSessionUpdate: (session: MROSession) => void;
  onReset: () => void;
  onAddProfile: (username: string) => void;
  onSelectProfile: (profileId: string) => void;
  onRemoveProfile: (profileId: string) => void;
  onNavigateToRegister: () => void;
  isLoading?: boolean;
  onLogout?: () => void;
}

type Tab = 'profile' | 'analysis' | 'strategies' | 'creatives' | 'growth';

export const Dashboard = ({ 
  session, 
  onSessionUpdate, 
  onReset,
  onAddProfile,
  onSelectProfile,
  onRemoveProfile,
  onNavigateToRegister,
  isLoading,
  onLogout
}: DashboardProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [showCreativeGenerator, setShowCreativeGenerator] = useState(false);
  const [isManualCreativeMode, setIsManualCreativeMode] = useState(false);

  // Get active profile
  const activeProfile = session.profiles.find(p => p.id === session.activeProfileId);

  // Clean expired creatives on mount
  useEffect(() => {
    const cleanup = async () => {
      await cleanExpiredCreatives();
      const updatedSession = getSession();
      onSessionUpdate(updatedSession);
    };
    cleanup();
  }, []);

  const getLoggedInUsername = () => getCurrentUser()?.username || 'anonymous';

  const refreshSession = () => {
    const updatedSession = getSession();
    onSessionUpdate(updatedSession);
    // Sync to server
    syncSessionToPersistent(getLoggedInUsername());
  };

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: <User className="w-4 h-4" /> },
    { id: 'analysis', label: 'Análise', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'strategies', label: 'Estratégias', icon: <Lightbulb className="w-4 h-4" /> },
    { id: 'creatives', label: 'Criativos', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'growth', label: 'Crescimento', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  const handleStrategyGenerated = (strategy: Strategy) => {
    addStrategy(strategy);
    refreshSession();
    // Sync immediately after strategy generation
    syncSessionToPersistent(getLoggedInUsername());
  };

  const handleGenerateCreative = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setShowCreativeGenerator(true);
  };

  const handleCreativeGenerated = (creative: Creative, creditsUsed: number = 1) => {
    // Add creative multiple times based on credits (for tracking purposes, the creative is only added once)
    addCreative(creative);
    // If manual mode used 2 credits, we need to decrement an extra time
    if (creditsUsed > 1) {
      // The addCreative already decrements 1, so we need to manually adjust for extra credits
      const session = getSession();
      const activeProfileSession = session.profiles.find(p => p.id === session.activeProfileId);
      if (activeProfileSession) {
        activeProfileSession.creativesRemaining = Math.max(0, activeProfileSession.creativesRemaining - (creditsUsed - 1));
        saveSession(session);
      }
    }
    refreshSession();
    setShowCreativeGenerator(false);
    setActiveTab('creatives');
  };

  const handleReset = () => {
    if (confirm('Tem certeza que deseja resetar todas as informações? Esta ação não pode ser desfeita.')) {
      resetSession();
      onReset();
    }
  };

  if (!activeProfile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-card border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo size="sm" />
              {/* Botão Ferramenta MRO */}
              <Button
                onClick={() => navigate('/mro-ferramenta')}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold shadow-lg shadow-yellow-500/30 animate-pulse-slow"
              >
                <Wrench className="w-4 h-4 mr-2" />
                Ferramenta MRO
              </Button>
              <div className="hidden md:block">
                <ProfileSelector
                  profiles={session.profiles}
                  activeProfileId={session.activeProfileId}
                  onSelectProfile={onSelectProfile}
                  onAddProfile={onNavigateToRegister}
                  onRemoveProfile={onRemoveProfile}
                  isLoading={isLoading}
                />
              </div>
            </div>

            {/* Tabs - Desktop */}
            <nav className="hidden md:flex items-center gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.id === 'strategies' && activeProfile.strategies.length > 0 && (
                    <span className="ml-1 w-5 h-5 rounded-full bg-primary-foreground/20 text-xs flex items-center justify-center">
                      {activeProfile.strategies.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              {onLogout && <UserHeader onLogout={onLogout} />}
            </div>
          </div>

          {/* Mobile Profile Selector */}
          <div className="md:hidden mt-3">
            <ProfileSelector
              profiles={session.profiles}
              activeProfileId={session.activeProfileId}
              onSelectProfile={onSelectProfile}
              onAddProfile={onNavigateToRegister}
              onRemoveProfile={onRemoveProfile}
              isLoading={isLoading}
            />
          </div>

          {/* Tabs - Mobile */}
          <nav className="flex md:hidden items-center gap-2 mt-4 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {activeTab === 'profile' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <ProfileCard profile={activeProfile.profile} />
            
            {/* Recent Posts Grid */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-display font-semibold mb-4">Posts Recentes</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {activeProfile.profile.recentPosts.slice(0, 6).map((post, index) => (
                  <div key={post.id} className="aspect-square rounded-lg overflow-hidden relative group">
                    <img 
                      src={post.imageUrl} 
                      alt="Post"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `https://picsum.photos/seed/${activeProfile.profile?.username}${index}/400/400`;
                      }}
                    />
                    <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="text-center text-sm">
                        <p>❤️ {post.likes}</p>
                        <p>💬 {post.comments}</p>
                      </div>
                    </div>
                    {!post.hasHumanFace && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-destructive" title="Sem rosto humano detectado" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="max-w-3xl mx-auto">
            <AnalysisCard analysis={activeProfile.analysis} />
          </div>
        )}

        {activeTab === 'strategies' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <StrategyGenerator 
              profile={activeProfile.profile}
              analysis={activeProfile.analysis}
              onStrategyGenerated={handleStrategyGenerated}
              existingStrategies={activeProfile.strategies}
              profileId={activeProfile.id}
            />
            
            {activeProfile.strategies.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-xl font-display font-bold">Estratégias Geradas</h3>
                {activeProfile.strategies.map((strategy) => (
                  <StrategyDisplay 
                    key={strategy.id}
                    strategy={strategy}
                    onGenerateCreative={handleGenerateCreative}
                    creativesRemaining={activeProfile.creativesRemaining}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'creatives' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Manual Creative Generation Button */}
            {activeProfile.creativesRemaining >= 2 && (
              <div className="glass-card glow-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-display font-bold flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-primary" />
                      Gerar Criativo Manual
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Crie um criativo com seu próprio prompt e inclua sua foto pessoal (usa 2 créditos)
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setIsManualCreativeMode(true);
                      // Create a dummy strategy for manual mode
                      setSelectedStrategy({
                        id: 'manual',
                        title: 'Criativo Manual',
                        description: 'Criativo personalizado',
                        type: 'content',
                        steps: [],
                        scripts: [],
                        storiesCalendar: [],
                        createdAt: new Date().toISOString()
                      });
                      setShowCreativeGenerator(true);
                    }}
                    variant="gradient"
                    className="cursor-pointer"
                  >
                    <Lightbulb className="w-4 h-4 mr-2" />
                    Criar com Prompt
                  </Button>
                </div>
                <div className="mt-3 text-xs text-muted-foreground bg-secondary/30 p-2 rounded">
                  💡 Você pode subir uma foto sua e a IA vai criar o criativo com você na imagem, mantendo seu rosto idêntico.
                </div>
              </div>
            )}
            
            {activeProfile.creativesRemaining < 2 && activeProfile.creativesRemaining > 0 && (
              <div className="glass-card p-4 border-warning/30 bg-warning/10">
                <p className="text-sm text-warning">
                  Você tem apenas {activeProfile.creativesRemaining} crédito(s). Geração manual requer 2 créditos.
                </p>
              </div>
            )}

            <CreativesGallery 
              creatives={activeProfile.creatives}
              creativesRemaining={activeProfile.creativesRemaining}
              onUpdate={refreshSession}
            />
          </div>
        )}

        {activeTab === 'growth' && (
          <div className="max-w-3xl mx-auto">
            <GrowthTracker 
              profileSession={activeProfile}
              onUpdate={refreshSession}
            />
          </div>
        )}
      </main>

      {/* Creative Generator Modal */}
      {showCreativeGenerator && selectedStrategy && activeProfile && (
        <CreativeGenerator
          strategy={selectedStrategy}
          profile={activeProfile.profile}
          niche={activeProfile.analysis.niche}
          onCreativeGenerated={(creative, creditsUsed) => {
            handleCreativeGenerated(creative, creditsUsed);
            setIsManualCreativeMode(false);
          }}
          onClose={() => {
            setShowCreativeGenerator(false);
            setIsManualCreativeMode(false);
          }}
          isManualMode={isManualCreativeMode}
          creativesRemaining={activeProfile.creativesRemaining}
        />
      )}
    </div>
  );
};
