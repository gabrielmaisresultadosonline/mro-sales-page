import { useState, useRef } from 'react';
import { Strategy, Creative, InstagramProfile, CreativeConfig, CreativeColors } from '@/types/instagram';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download, Sparkles, Image as ImageIcon, Upload, X, Palette, AlignLeft, AlignCenter, AlignRight, Plus, Type, AlertCircle, Lock, Phone } from 'lucide-react';
import { generateCreative, uploadCreativeImage } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { getCurrentUser } from '@/lib/userStorage';
import { canUseCreatives, isLifetimeAccess } from '@/types/user';

interface CreativeGeneratorProps {
  strategy: Strategy;
  profile: InstagramProfile;
  niche: string;
  onCreativeGenerated: (creative: Creative, creditsUsed: number) => void;
  onClose: () => void;
  isManualMode?: boolean;
  creativesRemaining: number;
}

const COLOR_PRESETS: { name: string; colors: CreativeColors }[] = [
  { name: 'Azul Profissional', colors: { primary: '#1e40af', secondary: '#3b82f6', text: '#ffffff' } },
  { name: 'Verde Natureza', colors: { primary: '#166534', secondary: '#22c55e', text: '#ffffff' } },
  { name: 'Roxo Criativo', colors: { primary: '#7c3aed', secondary: '#a78bfa', text: '#ffffff' } },
  { name: 'Laranja Energia', colors: { primary: '#ea580c', secondary: '#fb923c', text: '#ffffff' } },
  { name: 'Rosa Moderno', colors: { primary: '#db2777', secondary: '#f472b6', text: '#ffffff' } },
  { name: 'Preto Elegante', colors: { primary: '#18181b', secondary: '#3f3f46', text: '#ffffff' } },
  { name: 'Dourado Premium', colors: { primary: '#b45309', secondary: '#fbbf24', text: '#ffffff' } },
  { name: 'Vermelho Impacto', colors: { primary: '#dc2626', secondary: '#f87171', text: '#ffffff' } },
];

const FONT_COLORS = [
  { name: 'Branco', value: '#ffffff' },
  { name: 'Preto', value: '#000000' },
  { name: 'Dourado', value: '#fbbf24' },
  { name: 'Amarelo', value: '#facc15' },
  { name: 'Vermelho', value: '#ef4444' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Rosa', value: '#ec4899' },
];

export const CreativeGenerator = ({ 
  strategy, 
  profile, 
  niche, 
  onCreativeGenerated, 
  onClose,
  isManualMode = false,
  creativesRemaining
}: CreativeGeneratorProps) => {
  // Check if user can use creatives
  const user = getCurrentUser();
  const creativesAccess = canUseCreatives(user);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCreative, setGeneratedCreative] = useState<Creative | null>(null);
  const [step, setStep] = useState<'config' | 'generating' | 'result'>('config');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCreditWarning, setShowCreditWarning] = useState(isManualMode);
  const [personPhoto, setPersonPhoto] = useState<string | null>(null);
  const [includeText, setIncludeText] = useState(true);
  const [includeLogo, setIncludeLogo] = useState(true);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const personPhotoRef = useRef<HTMLInputElement>(null);

  const creditsNeeded = isManualMode ? 2 : 1;
  const hasEnoughCredits = creativesRemaining >= creditsNeeded;

  // Configuration state
  const [config, setConfig] = useState<CreativeConfig>({
    colors: COLOR_PRESETS[0].colors,
    logoType: 'profile',
    logoPosition: 'center',
    fontColor: '#ffffff',
    businessType: niche || 'marketing digital',
    customColors: [],
  });
  const [customLogoPreview, setCustomLogoPreview] = useState<string | null>(null);
  const [newCustomColor, setNewCustomColor] = useState('#00ff00');
  const [showCustomColorInput, setShowCustomColorInput] = useState(false);

  const handleColorSelect = (colors: CreativeColors) => {
    setConfig(prev => ({ ...prev, colors }));
  };

  const addCustomColor = () => {
    if (newCustomColor && (config.customColors?.length || 0) < 4) {
      setConfig(prev => ({
        ...prev,
        customColors: [...(prev.customColors || []), newCustomColor],
      }));
      setNewCustomColor('#00ff00');
      setShowCustomColorInput(false);
    }
  };

  const removeCustomColor = (index: number) => {
    setConfig(prev => ({
      ...prev,
      customColors: prev.customColors?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setCustomLogoPreview(base64);
        setConfig(prev => ({ ...prev, logoType: 'custom', customLogoUrl: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const clearCustomLogo = () => {
    setCustomLogoPreview(null);
    setConfig(prev => ({ ...prev, logoType: 'profile', customLogoUrl: undefined }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePersonPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPersonPhoto(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPersonPhoto = () => {
    setPersonPhoto(null);
    if (personPhotoRef.current) personPhotoRef.current.value = '';
  };

  const handleGenerateCreative = async () => {
    if (!hasEnoughCredits) {
      toast({
        title: "Créditos insuficientes",
        description: `Você precisa de ${creditsNeeded} crédito(s) mas tem apenas ${creativesRemaining}`,
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setStep('generating');
    
    toast({
      title: "Gerando criativo com I.A MRO...",
      description: isManualMode 
        ? "Criando imagem personalizada com seu prompt (2 créditos)"
        : "Criando imagem personalizada com sua marca (1 crédito)",
    });

    try {
      // Determine which logo URL to use
      let logoUrl: string | undefined;
      if (includeLogo) {
        if (config.logoType === 'profile') {
          logoUrl = profile.profilePicUrl;
        } else if (config.logoType === 'custom' && config.customLogoUrl) {
          logoUrl = config.customLogoUrl;
        }
      }

      const result = await generateCreative(
        strategy, 
        profile, 
        niche, 
        config, 
        logoUrl,
        isManualMode,
        customPrompt,
        personPhoto || undefined,
        includeText,
        includeLogo
      );

      if (result.success && result.creative) {
        // Add config data to the creative
        result.creative.colors = config.colors;
        result.creative.logoUrl = includeLogo ? logoUrl : undefined;
        result.creative.downloaded = false;
        
        // Upload image to storage for permanent URL
        const currentUser = getCurrentUser();
        const username = currentUser?.username || profile.username;
        
        if (result.creative.imageUrl.startsWith('data:')) {
          toast({
            title: "Salvando criativo...",
            description: "Fazendo upload para armazenamento permanente",
          });
          
          const uploadResult = await uploadCreativeImage(
            username,
            result.creative.id,
            result.creative.imageUrl
          );
          
          if (uploadResult.success && uploadResult.url) {
            result.creative.imageUrl = uploadResult.url;
            console.log('✅ Creative uploaded to storage:', uploadResult.url);
          } else {
            console.warn('⚠️ Failed to upload creative to storage, using base64');
          }
        }
        
        // Salvar automaticamente e contar crédito
        onCreativeGenerated(result.creative, creditsNeeded);
        
        setGeneratedCreative(result.creative);
        setStep('result');
        toast({
          title: "Criativo gerado e salvo! 🎨",
          description: `Usado ${creditsNeeded} crédito(s). Disponível na galeria por 1 mês.`,
        });
      } else {
        setStep('config');
        toast({
          title: "Erro ao gerar criativo",
          description: result.error || "Tente novamente",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setStep('config');
      toast({
        title: "Erro",
        description: "Não foi possível gerar o criativo",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // saveCreative removed - now auto-saves on generation

  const downloadImage = () => {
    if (generatedCreative?.imageUrl) {
      window.open(generatedCreative.imageUrl, '_blank');
      toast({
        title: "Download iniciado",
        description: "Criativo marcado como usado",
      });
    }
  };

  const getLogoPreview = () => {
    if (config.logoType === 'custom' && customLogoPreview) {
      return customLogoPreview;
    }
    if (config.logoType === 'profile') {
      return profile.profilePicUrl;
    }
    return null;
  };

  const getLogoPositionClass = () => {
    switch (config.logoPosition) {
      case 'left': return 'left-4';
      case 'right': return 'right-4';
      default: return 'left-1/2 -translate-x-1/2';
    }
  };

  // If user is lifetime and doesn't have creatives unlocked, show blocked message
  if (!creativesAccess.allowed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <div className="glass-card glow-border p-8 max-w-md w-full animate-slide-up text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          
          <h3 className="text-xl font-display font-bold mb-4">
            Acesso Bloqueado
          </h3>
          
          <p className="text-muted-foreground mb-6">
            {creativesAccess.reason}
          </p>
          
          <div className="p-4 rounded-lg bg-secondary/50 mb-6">
            <div className="flex items-center justify-center gap-2 text-amber-400 mb-2">
              <Phone className="w-4 h-4" />
              <span className="font-semibold">Contato Admin</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Solicite a liberação do gerador de criativos ao administrador da plataforma.
            </p>
          </div>
          
          <Button onClick={onClose} variant="outline" className="w-full">
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="glass-card glow-border p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-display font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            {isManualMode ? 'Gerar Criativo Manual' : 'Gerar Criativo com I.A MRO'}
          </h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Credit Warning for Manual Mode */}
        {isManualMode && (
          <div className="p-4 rounded-lg bg-warning/20 border border-warning/50 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-warning">Modo Manual - 2 Créditos</p>
                <p className="text-sm text-muted-foreground">
                  Gerar criativo com prompt personalizado usa <strong>2 créditos</strong> (vs 1 crédito pela estratégia).
                  Você tem <strong>{creativesRemaining} créditos</strong> disponíveis.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Strategy Info */}
        <div className="p-4 rounded-lg bg-secondary/50 mb-6">
          <p className="text-sm text-muted-foreground mb-1">
            {isManualMode ? 'Baseado no perfil:' : 'Baseado na estratégia:'}
          </p>
          <p className="font-semibold">
            {isManualMode ? `@${profile.username}` : strategy.title}
          </p>
        </div>

        {/* Step 1: Configuration */}
        {step === 'config' && (
          <div className="space-y-6">
            {/* Custom Prompt and Photo Upload for Manual Mode */}
            {isManualMode && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customPrompt" className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Seu Prompt Personalizado
                  </Label>
                  <textarea
                    id="customPrompt"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Descreva o criativo que você deseja... Ex: Uma imagem de hambúrguer gourmet com queijo derretendo, ambiente escuro e elegante"
                    className="w-full min-h-[100px] p-3 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Descreva detalhadamente o que você quer ver no criativo
                  </p>
                </div>

                {/* Person Photo Upload */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Sua Foto (Opcional)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Envie uma foto sua para aparecer no criativo com rosto e fisionomia idênticos
                  </p>
                  
                  <div className="flex items-center gap-4">
                    {personPhoto ? (
                      <div className="relative group">
                        <img 
                          src={personPhoto} 
                          alt="Sua foto" 
                          className="w-20 h-20 rounded-lg object-cover border-2 border-primary"
                        />
                        <button
                          type="button"
                          onClick={clearPersonPhoto}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-destructive rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                        >
                          <X className="w-4 h-4 text-destructive-foreground" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                        <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground">Upload</span>
                        <input
                          ref={personPhotoRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePersonPhotoUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                    
                    <div className="flex-1 text-sm text-muted-foreground">
                      {personPhoto ? (
                        <span className="text-success">✓ Foto carregada - será incluída no criativo</span>
                      ) : (
                        <span>A IA vai criar um criativo COM você na imagem, mantendo seu rosto idêntico</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Include Text Option */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                    <input
                      type="checkbox"
                      id="includeText"
                      checked={includeText}
                      onChange={(e) => setIncludeText(e.target.checked)}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <Label htmlFor="includeText" className="cursor-pointer text-sm">
                      Incluir texto (headline e CTA)
                    </Label>
                  </div>

                  {/* Include Logo Option */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                    <input
                      type="checkbox"
                      id="includeLogo"
                      checked={includeLogo}
                      onChange={(e) => setIncludeLogo(e.target.checked)}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <Label htmlFor="includeLogo" className="cursor-pointer text-sm">
                      Incluir logo na imagem
                    </Label>
                  </div>
                </div>

                {/* Info about image-only mode */}
                {!includeText && !includeLogo && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                    <p className="text-sm text-primary">
                      ✨ Modo imagem completa: A IA vai gerar apenas a imagem nas cores selecionadas, preenchendo toda a tela sem recortes.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Business Type */}
            <div className="space-y-2">
              <Label htmlFor="businessType" className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Tipo de Negócio / Tema do Fundo
              </Label>
              <Input
                id="businessType"
                value={config.businessType}
                onChange={(e) => setConfig(prev => ({ ...prev, businessType: e.target.value }))}
                placeholder="Ex: agência de marketing digital, loja de roupas..."
                className="bg-secondary/50"
              />
              <p className="text-xs text-muted-foreground">
                Será usado para gerar um fundo contextualizado
              </p>
            </div>

            {/* Color Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Cores do Criativo
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.name}
                    onClick={() => handleColorSelect(preset.colors)}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      config.colors.primary === preset.colors.primary
                        ? 'border-primary ring-2 ring-primary/50'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex gap-1 mb-2">
                      <div 
                        className="w-6 h-6 rounded-full" 
                        style={{ backgroundColor: preset.colors.primary }}
                      />
                      <div 
                        className="w-6 h-6 rounded-full" 
                        style={{ backgroundColor: preset.colors.secondary }}
                      />
                    </div>
                    <span className="text-xs">{preset.name}</span>
                  </button>
                ))}
              </div>

              {/* Custom Colors */}
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-2">Cores Personalizadas (máx. 4):</p>
                <div className="flex flex-wrap gap-2 items-center">
                  {config.customColors?.map((color, index) => (
                    <div key={index} className="relative group">
                      <div 
                        className="w-10 h-10 rounded-full border-2 border-border cursor-pointer"
                        style={{ backgroundColor: color }}
                      />
                      <button
                        type="button"
                        onClick={() => removeCustomColor(index)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full items-center justify-center hidden group-hover:flex cursor-pointer"
                      >
                        <X className="w-3 h-3 text-destructive-foreground" />
                      </button>
                    </div>
                  ))}
                  
                  {(config.customColors?.length || 0) < 4 && (
                    showCustomColorInput ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={newCustomColor}
                          onChange={(e) => setNewCustomColor(e.target.value)}
                          className="w-10 h-10 rounded-full cursor-pointer"
                        />
                        <Button type="button" size="sm" onClick={addCustomColor} className="cursor-pointer">
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setShowCustomColorInput(false)} className="cursor-pointer">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowCustomColorInput(true)}
                        className="w-10 h-10 rounded-full border-2 border-dashed border-border flex items-center justify-center hover:border-primary/50 transition-colors cursor-pointer"
                      >
                        <Plus className="w-5 h-5 text-muted-foreground" />
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Font Color Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Type className="w-4 h-4" />
                Cor da Fonte
              </Label>
              <div className="flex flex-wrap gap-2">
                {FONT_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color.value}
                    onClick={() => setConfig(prev => ({ ...prev, fontColor: color.value }))}
                    className={`w-10 h-10 rounded-full border-2 transition-all cursor-pointer ${
                      config.fontColor === color.value
                        ? 'border-primary ring-2 ring-primary/50 scale-110'
                        : 'border-border hover:border-primary/50'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Logo Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Logo do Criativo
              </Label>
              
              <div className="grid grid-cols-3 gap-3">
                {/* Profile Logo Option */}
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, logoType: 'profile' }))}
                  className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    config.logoType === 'profile'
                      ? 'border-primary ring-2 ring-primary/50 bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <img 
                    src={profile.profilePicUrl} 
                    alt="Profile" 
                    className="w-12 h-12 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = `https://api.dicebear.com/7.x/initials/svg?seed=${profile.username}`;
                    }}
                  />
                  <span className="text-xs text-center">Logo do Instagram</span>
                </button>

                {/* Custom Logo Option */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    config.logoType === 'custom'
                      ? 'border-primary ring-2 ring-primary/50 bg-primary/10'
                      : 'border-border hover:border-primary/50 border-dashed'
                  }`}
                >
                  {customLogoPreview ? (
                    <>
                      <div className="relative">
                        <img 
                          src={customLogoPreview} 
                          alt="Custom" 
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); clearCustomLogo(); }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3 h-3 text-destructive-foreground" />
                        </button>
                      </div>
                      <span className="text-xs text-center">Logo Customizada</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-muted-foreground" />
                      <span className="text-xs text-center">Fazer Upload</span>
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />

                {/* No Logo Option */}
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, logoType: 'none' }))}
                  className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    config.logoType === 'none'
                      ? 'border-primary ring-2 ring-primary/50 bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <X className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <span className="text-xs text-center">Sem Logo</span>
                </button>
              </div>

              {/* Logo Position */}
              {config.logoType !== 'none' && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-2">Posição da Logo:</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, logoPosition: 'left' }))}
                      className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        config.logoPosition === 'left'
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <AlignLeft className="w-4 h-4" />
                      <span className="text-xs">Esquerda</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, logoPosition: 'center' }))}
                      className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        config.logoPosition === 'center'
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <AlignCenter className="w-4 h-4" />
                      <span className="text-xs">Centro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, logoPosition: 'right' }))}
                      className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        config.logoPosition === 'right'
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <AlignRight className="w-4 h-4" />
                      <span className="text-xs">Direita</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Preview Area */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border">
              <p className="text-sm font-medium mb-3">Pré-visualização do Prompt:</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>🎨 <strong>Fundo:</strong> {config.businessType}</p>
                <p>🎯 <strong>Cores:</strong> {COLOR_PRESETS.find(p => p.colors.primary === config.colors.primary)?.name || 'Personalizada'}</p>
                {config.customColors && config.customColors.length > 0 && (
                  <p>🌈 <strong>Cores extras:</strong> {config.customColors.length} cores personalizadas</p>
                )}
                <p>📌 <strong>Logo:</strong> {
                  config.logoType === 'profile' ? 'Do Instagram' :
                  config.logoType === 'custom' ? 'Customizada' : 'Sem logo'
                } {config.logoType !== 'none' && `(${config.logoPosition})`}</p>
                <p>✏️ <strong>Cor da fonte:</strong> <span style={{ color: config.fontColor }}>■</span> {FONT_COLORS.find(c => c.value === config.fontColor)?.name || 'Personalizada'}</p>
                <p>💬 <strong>CTA:</strong> Gerado pela I.A MRO com base na estratégia</p>
              </div>
            </div>

            <Button 
              type="button"
              onClick={handleGenerateCreative} 
              variant="gradient" 
              size="lg" 
              className="w-full cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              Gerar Criativo com I.A MRO
            </Button>
          </div>
        )}

        {/* Step 2: Generating */}
        {step === 'generating' && (
          <div className="space-y-4">
            <div className="aspect-square rounded-lg bg-secondary/50 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 mb-4 animate-spin text-primary" />
              <p className="text-sm">Gerando criativo com I.A MRO...</p>
              <p className="text-xs mt-2 text-muted-foreground">Isso pode levar alguns segundos</p>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 'result' && generatedCreative && (
          <div className="space-y-4">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-secondary">
              <img 
                src={generatedCreative.imageUrl} 
                alt="Criativo gerado" 
                className="w-full h-full object-cover"
              />
              {/* Overlay with text */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent flex flex-col justify-end p-6">
                {/* Logo with position */}
                {getLogoPreview() && (
                  <div className={`absolute top-4 ${getLogoPositionClass()}`}>
                    <img 
                      src={getLogoPreview()!} 
                      alt="Logo" 
                      className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-lg"
                    />
                  </div>
                )}
                
                <h4 
                  className="text-2xl font-display font-bold text-center mb-2 px-4"
                  style={{ color: config.fontColor }}
                >
                  {generatedCreative.headline}
                </h4>
                <span 
                  className="mx-auto px-6 py-3 rounded-full font-semibold"
                  style={{ 
                    backgroundColor: config.colors.primary, 
                    color: config.fontColor 
                  }}
                >
                  {generatedCreative.ctaText}
                </span>
              </div>
            </div>

            {/* Action buttons - only download and close since already saved */}
            <div className="flex gap-3">
              <Button type="button" onClick={downloadImage} variant="gradient" className="flex-1 cursor-pointer">
                <Download className="w-4 h-4" />
                Download
              </Button>
              <Button type="button" onClick={onClose} variant="outline" className="flex-1 cursor-pointer">
                Fechar
              </Button>
            </div>
            
            <div className="p-3 rounded-lg bg-success/10 border border-success/30">
              <p className="text-sm text-success text-center">
                ✅ Criativo salvo automaticamente! Disponível na galeria por 1 mês.
              </p>
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              💡 Para gerar outro criativo, volte à galeria e use seus créditos restantes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};