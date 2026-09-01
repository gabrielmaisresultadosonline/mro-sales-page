import { Strategy } from '@/types/instagram';
import { Zap, Calendar, MessageSquare, ChevronDown, ChevronUp, Clock, Info, User, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface StrategyDisplayProps {
  strategy: Strategy;
  onGenerateCreative: (strategy: Strategy) => void;
  creativesRemaining: number;
}

export const StrategyDisplay = ({ strategy, onGenerateCreative, creativesRemaining }: StrategyDisplayProps) => {
  const { toast } = useToast();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    steps: true,
    mroTutorial: false,
    scripts: false,
    stories: false,
    posts: false,
    metaTutorial: false,
    bioAnalysis: true,
    suggestedBios: true,
    bioTips: false,
  });
  const [copiedBio, setCopiedBio] = useState<number | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const copyBio = async (bio: string, index: number) => {
    await navigator.clipboard.writeText(bio);
    setCopiedBio(index);
    toast({ title: "Bio copiada!", description: "Cole no Instagram" });
    setTimeout(() => setCopiedBio(null), 2000);
  };

  const typeIcons: Record<string, React.ReactNode> = {
    mro: <Zap className="w-5 h-5" />,
    content: <Calendar className="w-5 h-5" />,
    engagement: <MessageSquare className="w-5 h-5" />,
    sales: <MessageSquare className="w-5 h-5" />,
    bio: <User className="w-5 h-5" />,
  };

  const typeColors: Record<string, string> = {
    mro: 'bg-primary/20 text-primary',
    content: 'bg-mro-cyan/20 text-mro-cyan',
    engagement: 'bg-mro-purple/20 text-mro-purple',
    sales: 'bg-mro-green/20 text-mro-green',
    bio: 'bg-amber-500/20 text-amber-500',
  };

  return (
    <div className="glass-card p-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className={`p-2 rounded-lg ${typeColors[strategy.type]}`}>
              {typeIcons[strategy.type]}
            </span>
            <h3 className="text-xl font-display font-bold">{strategy.title}</h3>
          </div>
          <p className="text-muted-foreground text-sm">{strategy.description}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(strategy.createdAt).toLocaleDateString('pt-BR')}
        </span>
      </div>

      {/* Steps */}
      <CollapsibleSection
        title="Passos da Estratégia"
        isExpanded={expandedSections.steps}
        onToggle={() => toggleSection('steps')}
      >
        <ul className="space-y-2">
          {strategy.steps.map((step, i) => (
            <li key={i} className="text-sm p-3 rounded-lg bg-secondary/50 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      {/* Bio Analysis - Only for bio type */}
      {strategy.type === 'bio' && strategy.bioAnalysis && (
        <CollapsibleSection
          title="📊 Análise da Bio Atual"
          isExpanded={expandedSections.bioAnalysis}
          onToggle={() => toggleSection('bioAnalysis')}
        >
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Bio Atual:</p>
              <p className="text-sm italic">"{strategy.bioAnalysis.currentBio}"</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm font-semibold text-destructive mb-2">❌ Problemas Identificados</p>
                <ul className="space-y-1">
                  {strategy.bioAnalysis.problems.map((problem: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground">• {problem}</li>
                  ))}
                </ul>
              </div>
              
              <div className="p-3 rounded-lg bg-mro-green/10 border border-mro-green/20">
                <p className="text-sm font-semibold text-mro-green mb-2">✅ Pontos Fortes</p>
                <ul className="space-y-1">
                  {strategy.bioAnalysis.strengths.map((strength: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground">• {strength}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Suggested Bios - Only for bio type */}
      {strategy.type === 'bio' && strategy.suggestedBios && (
        <CollapsibleSection
          title="✨ Bios Sugeridas (Clique para copiar)"
          isExpanded={expandedSections.suggestedBios}
          onToggle={() => toggleSection('suggestedBios')}
        >
          <div className="space-y-3">
            {strategy.suggestedBios.map((item: { bio: string; focus: string }, i: number) => (
              <button
                key={i}
                type="button"
                onClick={() => copyBio(item.bio, i)}
                className="w-full p-4 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all text-left cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-2">{item.bio}</p>
                    <p className="text-xs text-muted-foreground">{item.focus}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {copiedBio === i ? (
                      <Check className="w-5 h-5 text-mro-green" />
                    ) : (
                      <Copy className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Bio Tips - Only for bio type */}
      {strategy.type === 'bio' && strategy.tips && (
        <CollapsibleSection
          title="💡 Dicas para Bio Perfeita"
          isExpanded={expandedSections.bioTips}
          onToggle={() => toggleSection('bioTips')}
        >
          <ul className="space-y-2">
            {strategy.tips.map((tip: string, i: number) => (
              <li key={i} className="text-sm p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                {tip}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* MRO Tutorial */}
      {strategy.mroTutorial && (
        <CollapsibleSection
          title="🤖 Tutorial MRO Inteligente"
          isExpanded={expandedSections.mroTutorial}
          onToggle={() => toggleSection('mroTutorial')}
        >
          <div className="space-y-4">
            <div>
              <h5 className="font-semibold text-sm mb-2 text-primary">Ações Diárias</h5>
              <div className="space-y-2">
                {strategy.mroTutorial.dailyActions.map((action, i) => (
                  <div key={i} className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{action.action}</span>
                      <span className="text-xs bg-primary/20 px-2 py-1 rounded">{action.quantity}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h5 className="font-semibold text-sm mb-2 text-mro-purple">Estratégia de Unfollow</h5>
              <ul className="space-y-1">
                {strategy.mroTutorial.unfollowStrategy.map((step, i) => (
                  <li key={i} className="text-sm p-2 rounded bg-mro-purple/10">{step}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-mro-cyan/10 border border-mro-cyan/20">
              <p className="text-sm font-medium text-mro-cyan">📌 Conta de Referência</p>
              <p className="text-xs text-muted-foreground mt-1">{strategy.mroTutorial.competitorReference}</p>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Posts Calendar */}
      {strategy.postsCalendar && strategy.postsCalendar.length > 0 && (
        <CollapsibleSection
          title="📅 Calendário de Posts (3 em 3 dias)"
          isExpanded={expandedSections.posts}
          onToggle={() => toggleSection('posts')}
        >
          <div className="overflow-x-auto">
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {strategy.postsCalendar.map((post, i) => (
                <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold bg-primary/20 text-primary px-2 py-1 rounded">
                        {post.date}
                      </span>
                      <span className="text-xs text-muted-foreground">{post.dayOfWeek}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs">{post.bestTime}</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium mb-1">{post.postType}</p>
                  <p className="text-xs text-muted-foreground mb-2">{post.content}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {post.hashtags.map((tag, j) => (
                      <span key={j} className="text-xs bg-mro-cyan/10 text-mro-cyan px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-mro-green">💡 CTA: {post.cta}</p>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Meta Scheduling Tutorial */}
      {strategy.metaSchedulingTutorial && (
        <CollapsibleSection
          title="📱 Como Agendar no Meta Business Suite"
          isExpanded={expandedSections.metaTutorial}
          onToggle={() => toggleSection('metaTutorial')}
        >
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-start gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-500 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Use o Meta Business Suite para agendar seus posts de 3 em 3 dias conforme o calendário acima.
              </p>
            </div>
            <ol className="space-y-2">
              {strategy.metaSchedulingTutorial.map((step, i) => (
                <li key={i} className="text-sm p-2 rounded bg-secondary/30 flex items-start gap-2">
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </CollapsibleSection>
      )}

      {/* Scripts */}
      {strategy.scripts && strategy.scripts.length > 0 && (
        <CollapsibleSection
          title="Scripts de Vendas"
          isExpanded={expandedSections.scripts}
          onToggle={() => toggleSection('scripts')}
        >
          <div className="space-y-4">
            {strategy.scripts.map((script, i) => (
              <div key={i} className="p-4 rounded-lg bg-secondary/30 border border-border">
                <p className="font-semibold text-sm mb-3 text-primary">{script.situation}</p>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase">Abertura:</span>
                    <p className="mt-1">{script.opening}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase">Desenvolvimento:</span>
                    <p className="mt-1">{script.body}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase">Fechamento:</span>
                    <p className="mt-1">{script.closing}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase">Gatilhos de Escassez:</span>
                    <ul className="mt-1 space-y-1">
                      {script.scarcityTriggers.map((trigger, j) => (
                        <li key={j} className="text-mro-green">{trigger}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Stories Calendar */}
      {strategy.storiesCalendar && (
        <CollapsibleSection
          title="Calendário de Stories"
          isExpanded={expandedSections.stories}
          onToggle={() => toggleSection('stories')}
        >
          <div className="overflow-x-auto">
            <div className="flex gap-4 min-w-max pb-4">
              {strategy.storiesCalendar.map((day, i) => (
                <div key={i} className="w-48 flex-shrink-0">
                  <p className="font-semibold text-sm mb-3 text-center p-2 rounded-lg bg-primary/10">
                    {day.day}
                  </p>
                  <div className="space-y-2">
                    {day.stories.map((story, j) => (
                      <div 
                        key={j} 
                        className={`p-2 rounded-lg text-xs ${
                          story.hasButton ? 'bg-primary/20 border border-primary/30' : 'bg-secondary/50'
                        }`}
                      >
                        <span className="text-muted-foreground">{story.time}</span>
                        <p className="mt-1">{story.content}</p>
                        {story.hasButton && (
                          <span className="inline-block mt-2 px-2 py-1 bg-primary text-primary-foreground rounded text-xs">
                            {story.buttonText}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Generate Creative Button - Only for non-bio strategies */}
      {strategy.type !== 'bio' && (
        <div className="mt-6 pt-6 border-t border-border">
          <button
            type="button"
            onClick={() => onGenerateCreative(strategy)}
            disabled={creativesRemaining === 0}
            className={`w-full p-4 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
              creativesRemaining > 0
                ? 'bg-animated-gradient text-primary-foreground btn-glow hover:scale-[1.02]'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {creativesRemaining > 0 ? (
              <>
                🎨 Gerar Criativo para esta Estratégia
                <span className="text-xs opacity-80">({creativesRemaining} restantes)</span>
              </>
            ) : (
              'Limite de criativos atingido este mês'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

const CollapsibleSection = ({ 
  title, 
  isExpanded, 
  onToggle, 
  children 
}: { 
  title: string; 
  isExpanded: boolean; 
  onToggle: () => void; 
  children: React.ReactNode;
}) => (
  <div className="mb-4">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
    >
      <span className="font-semibold text-sm">{title}</span>
      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
    {isExpanded && <div className="mt-3">{children}</div>}
  </div>
);
