import { useState, useEffect } from 'react';
import { ProfileSession, GrowthSnapshot, GrowthInsight } from '@/types/instagram';
import { fetchInstagramProfile } from '@/lib/api';
import { addGrowthSnapshot, addGrowthInsight } from '@/lib/storage';
import { syncSessionToPersistent, markProfileFetched } from '@/lib/persistentStorage';
import { getCurrentUser } from '@/lib/userStorage';
import { TrendingUp, TrendingDown, Users, Heart, MessageCircle, Calendar, RefreshCw, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { GrowthPDFExport } from './GrowthPDFExport';

interface GrowthTrackerProps {
  profileSession: ProfileSession;
  onUpdate: () => void;
}

export const GrowthTracker = ({ profileSession, onUpdate }: GrowthTrackerProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const initialSnapshot = profileSession.initialSnapshot;
  const latestSnapshot = profileSession.growthHistory[profileSession.growthHistory.length - 1] || initialSnapshot;
  
  // Calculate total growth
  const totalFollowersGain = latestSnapshot.followers - initialSnapshot.followers;
  const totalFollowersPercent = initialSnapshot.followers > 0 
    ? ((totalFollowersGain / initialSnapshot.followers) * 100).toFixed(1)
    : '0';
  
  const engagementChange = (latestSnapshot.engagement - initialSnapshot.engagement).toFixed(2);
  const avgLikesChange = latestSnapshot.avgLikes - initialSnapshot.avgLikes;
  
  // Calculate days since start
  const startDate = new Date(profileSession.startedAt);
  const now = new Date();
  const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const weeksSinceStart = Math.floor(daysSinceStart / 7);

  // Check if a week has passed since last snapshot
  const lastSnapshotDate = new Date(latestSnapshot.date);
  const daysSinceLastSnapshot = Math.floor((now.getTime() - lastSnapshotDate.getTime()) / (1000 * 60 * 60 * 24));
  const needsWeeklyUpdate = daysSinceLastSnapshot >= 7;

  const handleRefreshGrowth = async () => {
    setIsRefreshing(true);
    try {
      // Pass existing posts to preserve them if API doesn't return new ones
      const existingPosts = profileSession.profile.recentPosts || [];
      const result = await fetchInstagramProfile(profileSession.profile.username, existingPosts);
      
      if (result.success && result.profile) {
        addGrowthSnapshot(profileSession.id, result.profile);
        
        // Generate insight
        const previousSnapshot = profileSession.growthHistory[profileSession.growthHistory.length - 1] || initialSnapshot;
        const newInsight: GrowthInsight = {
          weekNumber: weeksSinceStart + 1,
          startDate: previousSnapshot.date,
          endDate: new Date().toISOString(),
          followersGain: result.profile.followers - previousSnapshot.followers,
          followersGainPercent: previousSnapshot.followers > 0 
            ? ((result.profile.followers - previousSnapshot.followers) / previousSnapshot.followers) * 100 
            : 0,
          engagementChange: result.profile.engagement - previousSnapshot.engagement,
          strategyBonus: generateStrategyBonus(profileSession.strategies.length),
          insights: generateInsights(previousSnapshot, result.profile),
        };
        
        addGrowthInsight(profileSession.id, newInsight);
        
        // PERSIST DATA PERMANENTLY
        markProfileFetched(profileSession.profile.username);
        const loggedInUsername = getCurrentUser()?.username || 'anonymous';
        syncSessionToPersistent(loggedInUsername);
        
        toast({
          title: "Dados atualizados! 📊",
          description: `Semana ${newInsight.weekNumber}: ${newInsight.followersGain >= 0 ? '+' : ''}${newInsight.followersGain} seguidores`,
        });
        
        onUpdate();
      } else {
        toast({
          title: "Erro ao atualizar",
          description: result.error || "Tente novamente mais tarde",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível buscar dados atualizados",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const generateStrategyBonus = (strategiesCount: number): string => {
    if (strategiesCount >= 4) return "🏆 Estratégia completa ativa";
    if (strategiesCount >= 2) return "⚡ Bom uso das estratégias";
    if (strategiesCount >= 1) return "🌱 Iniciando com estratégia";
    return "📋 Adicione estratégias para melhorar";
  };

  const generateInsights = (previous: GrowthSnapshot, current: any): string[] => {
    const insights: string[] = [];
    
    const followersGain = current.followers - previous.followers;
    if (followersGain > 0) {
      insights.push(`📈 Ganhou ${followersGain} novos seguidores`);
    } else if (followersGain < 0) {
      insights.push(`📉 Perdeu ${Math.abs(followersGain)} seguidores`);
    }
    
    const engagementChange = current.engagement - previous.engagement;
    if (engagementChange > 0.5) {
      insights.push(`🔥 Engajamento subiu ${engagementChange.toFixed(1)}%`);
    } else if (engagementChange < -0.5) {
      insights.push(`⚠️ Engajamento caiu ${Math.abs(engagementChange).toFixed(1)}%`);
    }
    
    if (current.avgLikes > previous.avgLikes) {
      insights.push(`❤️ Média de curtidas aumentou`);
    }
    
    if (insights.length === 0) {
      insights.push("📊 Métricas estáveis esta semana");
    }
    
    return insights;
  };

  // Calculate monitoring end date (1 year from start)
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);
  const daysRemaining = Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="glass-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-display font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Crescimento da Conta
          </h3>
          <p className="text-sm text-muted-foreground">
            Monitorando desde {startDate.toLocaleDateString('pt-BR')} • Semana {weeksSinceStart + 1}/52
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <GrowthPDFExport profileSession={profileSession} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshGrowth}
            disabled={isRefreshing}
            className={needsWeeklyUpdate ? 'border-primary text-primary animate-pulse' : ''}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {needsWeeklyUpdate ? 'Atualização semanal' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Seguidores"
          value={latestSnapshot.followers.toLocaleString()}
          change={totalFollowersGain}
          changePercent={totalFollowersPercent}
          isPositive={totalFollowersGain >= 0}
        />
        <StatCard
          icon={<Heart className="w-5 h-5" />}
          label="Média de Curtidas"
          value={latestSnapshot.avgLikes.toLocaleString()}
          change={avgLikesChange}
          isPositive={avgLikesChange >= 0}
        />
        <StatCard
          icon={<MessageCircle className="w-5 h-5" />}
          label="Engajamento"
          value={`${latestSnapshot.engagement.toFixed(2)}%`}
          change={parseFloat(engagementChange)}
          suffix="%"
          isPositive={parseFloat(engagementChange) >= 0}
        />
        <StatCard
          icon={<Calendar className="w-5 h-5" />}
          label="Dias Restantes"
          value={daysRemaining.toString()}
          subtitle="de monitoramento"
        />
      </div>

      {/* Strategy Bonus */}
      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
        <div className="flex items-center gap-3">
          <Award className="w-6 h-6 text-primary" />
          <div>
            <p className="font-semibold">Bonificação da Estratégia</p>
            <p className="text-sm text-muted-foreground">
              {generateStrategyBonus(profileSession.strategies.length)}
            </p>
          </div>
        </div>
      </div>

      {/* Weekly Insights */}
      {profileSession.growthInsights.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Histórico Semanal</h4>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {[...profileSession.growthInsights].reverse().slice(0, 5).map((insight, i) => (
              <div key={i} className="p-3 rounded-lg bg-secondary/30 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Semana {insight.weekNumber}</span>
                  <span className={`flex items-center gap-1 ${insight.followersGain >= 0 ? 'text-mro-green' : 'text-destructive'}`}>
                    {insight.followersGain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {insight.followersGain >= 0 ? '+' : ''}{insight.followersGain} seguidores
                  </span>
                </div>
                <div className="space-y-1 text-muted-foreground text-xs">
                  {insight.insights.map((text, j) => (
                    <p key={j}>{text}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info about monitoring */}
      <div className="text-xs text-muted-foreground text-center p-3 rounded-lg bg-secondary/20">
        💡 O monitoramento ocorre semanalmente por 1 ano. Atualize manualmente ou aguarde a próxima semana.
      </div>
    </div>
  );
};

const StatCard = ({ 
  icon, 
  label, 
  value, 
  change, 
  changePercent, 
  suffix = '', 
  isPositive = true,
  subtitle
}: { 
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: number;
  changePercent?: string;
  suffix?: string;
  isPositive?: boolean;
  subtitle?: string;
}) => (
  <div className="p-4 rounded-lg bg-secondary/30 border border-border">
    <div className="flex items-center gap-2 text-muted-foreground mb-2">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
    <p className="text-2xl font-bold">{value}</p>
    {change !== undefined && (
      <p className={`text-xs flex items-center gap-1 ${isPositive ? 'text-mro-green' : 'text-destructive'}`}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isPositive && change > 0 ? '+' : ''}{change.toLocaleString()}{suffix}
        {changePercent && ` (${changePercent}%)`}
      </p>
    )}
    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
  </div>
);
