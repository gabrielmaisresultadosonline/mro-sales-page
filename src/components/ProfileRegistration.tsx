import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  AlertTriangle, 
  Check, 
  Instagram, 
  Loader2, 
  LogOut,
  Mail, 
  RefreshCw, 
  UserPlus,
  Download,
  Camera
} from 'lucide-react';
import { InstagramProfile, ProfileAnalysis } from '@/types/instagram';
import { normalizeInstagramUsername } from '@/types/user';
import { addIGToSquare, saveEmailAndPrint, verifyRegisteredIGs, canRegisterIG } from '@/lib/squareApi';
import { 
  getCurrentUser, 
  updateUserEmail, 
  addRegisteredIG, 
  isIGRegistered,
  syncIGsFromSquare,
  getRegisteredIGs,
  loadUserFromCloud,
  saveUserSession,
  getUserSession
} from '@/lib/userStorage';
import { 
  getArchivedByUsername, 
  restoreProfileFromArchive,
  addProfile 
} from '@/lib/storage';
import { fetchInstagramProfile, analyzeProfile } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';

interface ProfileRegistrationProps {
  onProfileRegistered: (profile: InstagramProfile, analysis: ProfileAnalysis) => void;
  onSyncComplete: (instagrams: string[]) => void;
  onLogout?: () => void;
}

export const ProfileRegistration = ({ onProfileRegistered, onSyncComplete, onLogout }: ProfileRegistrationProps) => {
  const [instagramInput, setInstagramInput] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showSyncOfferDialog, setShowSyncOfferDialog] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<InstagramProfile | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<ProfileAnalysis | null>(null);
  const [pendingSyncIG, setPendingSyncIG] = useState<string>('');
  const [registeredIGs, setRegisteredIGs] = useState<string[]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const user = getCurrentUser();

  useEffect(() => {
    // Load saved email
    if (user?.email) {
      setEmail(user.email);
    }
    // Load registered IGs
    const igs = getRegisteredIGs();
    setRegisteredIGs(igs.map(ig => ig.username));
    
    // CRITICAL FIX: If we have registered IGs but no email, try to reload from cloud
    // This fixes the "partial data loaded" bug on some browsers
    const checkAndFixPartialData = async () => {
      if (user?.username && igs.length > 0 && !user?.email) {
        console.log('[ProfileRegistration] Detected partial data (profiles but no email), reloading from cloud...');
        try {
          const cloudData = await loadUserFromCloud(user.username);
          if (cloudData?.email) {
            console.log('[ProfileRegistration] Found email in cloud, updating session...');
            setEmail(cloudData.email);
            // Update the session with the cloud email
            const session = getUserSession();
            if (session.user) {
              session.user.email = cloudData.email;
              session.user.isEmailLocked = cloudData.isEmailLocked;
              saveUserSession(session);
            }
          }
        } catch (e) {
          console.error('[ProfileRegistration] Error fixing partial data:', e);
        }
      }
    };
    
    checkAndFixPartialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, user?.username]);

  // Handle syncing a single profile that already exists in SquareCloud
  const handleSyncSingleProfile = async () => {
    if (!pendingSyncIG || !user) return;
    
    setShowSyncOfferDialog(false);
    setIsLoading(true);
    setLoadingMessage(`Sincronizando @${pendingSyncIG}...`);
    
    try {
      // Check email before syncing
      if (!email.trim()) {
        toast({ 
          title: 'Digite seu e-mail', 
          description: 'Necessário para sincronizar',
          variant: 'destructive' 
        });
        setIsLoading(false);
        setLoadingMessage('');
        return;
      }

      updateUserEmail(email);
      
      // Check if profile was previously archived (has saved data)
      const archivedProfile = getArchivedByUsername(pendingSyncIG);
      
      if (archivedProfile) {
        // Restore from archive - keeps strategies, creatives, credits, etc.
        setLoadingMessage('Restaurando dados salvos...');
        const restored = restoreProfileFromArchive(pendingSyncIG);
        
        if (restored) {
          await syncIGsFromSquare([pendingSyncIG], email);
          setRegisteredIGs(prev => [...prev, pendingSyncIG]);
          
          toast({
            title: 'Perfil restaurado!',
            description: `@${pendingSyncIG} foi restaurado com todos os dados anteriores`
          });
          
          onSyncComplete([pendingSyncIG]);
          setPendingSyncIG('');
          setInstagramInput('');
          setIsLoading(false);
          setLoadingMessage('');
          return;
        }
      }
      
      // No archived data - just sync normally
      await syncIGsFromSquare([pendingSyncIG], email);
      setRegisteredIGs(prev => [...prev, pendingSyncIG]);
      
      toast({
        title: 'Perfil sincronizado!',
        description: `@${pendingSyncIG} foi vinculado à sua conta`
      });

      onSyncComplete([pendingSyncIG]);
      setPendingSyncIG('');
      setInstagramInput('');
    } catch (error) {
      toast({
        title: 'Erro na sincronização',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSearchProfile = async () => {
    if (!instagramInput.trim()) {
      toast({ title: 'Digite o Instagram', variant: 'destructive' });
      return;
    }

    if (!user) {
      toast({ title: 'Usuário não autenticado', variant: 'destructive' });
      return;
    }

    const normalizedIG = normalizeInstagramUsername(instagramInput);

    setIsLoading(true);
    setLoadingMessage('Verificando disponibilidade...');

    try {
      // FIRST: Check if can register in SquareCloud before fetching from Bright Data
      const checkResult = await canRegisterIG(user.username, normalizedIG);
      
      // Case 1: Profile already exists in SquareCloud - offer sync (even if it was removed from local)
      if (checkResult.alreadyExists) {
        setPendingSyncIG(normalizedIG);
        setShowSyncOfferDialog(true);
        setIsLoading(false);
        setLoadingMessage('');
        return;
      }
      
      // Case 2: Cannot register (limit reached)
      if (!checkResult.canRegister) {
        toast({
          title: 'Limite atingido',
          description: checkResult.error || 'Você não pode cadastrar mais perfis',
          variant: 'destructive'
        });
        setIsLoading(false);
        setLoadingMessage('');
        return;
      }

      // Case 3: Can register - fetch from Bright Data
      setLoadingMessage(`Buscando dados de @${normalizedIG}...`);
      
      const profileResult = await fetchInstagramProfile(normalizedIG);
      
      if (!profileResult.success || !profileResult.profile) {
        toast({
          title: 'Erro ao buscar perfil',
          description: profileResult.error || 'Perfil não encontrado',
          variant: 'destructive'
        });
        setIsLoading(false);
        setLoadingMessage('');
        return;
      }

      // Analyze profile
      setLoadingMessage('Analisando perfil com I.A...');
      
      const analysisResult = await analyzeProfile(profileResult.profile);
      
      if (!analysisResult.success || !analysisResult.analysis) {
        toast({
          title: 'Erro na análise',
          description: 'Não foi possível analisar o perfil',
          variant: 'destructive'
        });
        setIsLoading(false);
        setLoadingMessage('');
        return;
      }

      // Store pending data and show confirmation
      setPendingProfile(profileResult.profile);
      setPendingAnalysis(analysisResult.analysis);
      setShowConfirmDialog(true);

    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível processar o perfil',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleConfirmRegistration = () => {
    setShowConfirmDialog(false);
    setShowWarningDialog(true);
  };

  const handleFinalConfirmation = async () => {
    if (!pendingProfile || !pendingAnalysis || !user) return;

    // Check email
    if (!email.trim()) {
      toast({ title: 'Digite seu e-mail', variant: 'destructive' });
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ title: 'E-mail inválido', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setShowWarningDialog(false);

    try {
      // Save email to user session
      updateUserEmail(email);

      // Generate print image
      const printBlob = await generateProfilePrint(pendingProfile, pendingAnalysis);

      // Add IG to SquareCloud
      const addResult = await addIGToSquare(user.username, pendingProfile.username);
      
      if (!addResult.success) {
        toast({
          title: 'Erro ao cadastrar',
          description: addResult.error || 'Limite de cadastros atingido',
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      // Send print and email
      if (printBlob) {
        await saveEmailAndPrint(email, user.username, pendingProfile.username, printBlob);
      }

      // Register locally and save to database
      await addRegisteredIG(pendingProfile.username, email, false);
      setRegisteredIGs(prev => [...prev, normalizeInstagramUsername(pendingProfile.username)]);

      toast({
        title: 'Perfil cadastrado com sucesso!',
        description: `@${pendingProfile.username} foi vinculado à sua conta`
      });

      // Proceed with the registered profile
      onProfileRegistered(pendingProfile, pendingAnalysis);

    } catch (error) {
      toast({
        title: 'Erro ao cadastrar',
        description: 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setPendingProfile(null);
      setPendingAnalysis(null);
    }
  };

  const handleSyncAccounts = async () => {
    if (!user) return;

    setIsSyncing(true);

    try {
      const result = await verifyRegisteredIGs(user.username);
      
      if (result.success && result.instagrams && result.instagrams.length > 0) {
        // Check email before syncing
        if (!email.trim()) {
          toast({ 
            title: 'Digite seu e-mail', 
            description: 'Necessário para sincronizar',
            variant: 'destructive' 
          });
          setIsSyncing(false);
          return;
        }

        updateUserEmail(email);
        await syncIGsFromSquare(result.instagrams, email);
        setRegisteredIGs(result.instagrams);
        
        toast({
          title: 'Contas sincronizadas!',
          description: `${result.instagrams.length} Instagram(s) encontrado(s)`
        });

        onSyncComplete(result.instagrams);
      } else {
        toast({
          title: 'Nenhuma conta encontrada',
          description: 'Cadastre um novo perfil para começar'
        });
      }
    } catch (error) {
      toast({
        title: 'Erro na sincronização',
        variant: 'destructive'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const generateProfilePrint = async (
    profile: InstagramProfile, 
    analysis: ProfileAnalysis
  ): Promise<Blob | null> => {
    try {
      // Create a hidden div for the print
      const printDiv = document.createElement('div');
      printDiv.style.cssText = `
        position: fixed;
        left: -9999px;
        width: 600px;
        padding: 24px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: white;
        font-family: Inter, Arial, sans-serif;
        border-radius: 12px;
      `;
      
      printDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${profile.profilePicUrl}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid #00ff88; object-fit: cover;" crossorigin="anonymous" />
          <h2 style="margin: 12px 0 4px; font-size: 20px;">@${profile.username}</h2>
          <p style="color: #888; font-size: 14px; margin: 0;">${profile.fullName}</p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
          <div style="text-align: center; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px;">
            <div style="font-size: 20px; font-weight: bold; color: #00ff88;">${profile.followers.toLocaleString()}</div>
            <div style="font-size: 12px; color: #888;">Seguidores</div>
          </div>
          <div style="text-align: center; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px;">
            <div style="font-size: 20px; font-weight: bold; color: #00ff88;">${profile.following.toLocaleString()}</div>
            <div style="font-size: 12px; color: #888;">Seguindo</div>
          </div>
          <div style="text-align: center; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px;">
            <div style="font-size: 20px; font-weight: bold; color: #00ff88;">${profile.posts}</div>
            <div style="font-size: 12px; color: #888;">Posts</div>
          </div>
        </div>
        
        <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 16px;">
          <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Bio</div>
          <div style="font-size: 13px; line-height: 1.4;">${profile.bio || 'Sem bio'}</div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px;">
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #ff6b6b;">${analysis.contentScore}</div>
            <div style="font-size: 11px; color: #888;">Conteúdo</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #4ecdc4;">${analysis.engagementScore}</div>
            <div style="font-size: 11px; color: #888;">Engajamento</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #45b7d1;">${analysis.profileScore}</div>
            <div style="font-size: 11px; color: #888;">Perfil</div>
          </div>
        </div>
        
        <div style="text-align: center; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
          <div style="font-size: 11px; color: #666;">MRO Inteligente • ${new Date().toLocaleDateString('pt-BR')}</div>
        </div>
      `;
      
      document.body.appendChild(printDiv);
      
      // Wait for image to load
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(printDiv, {
        backgroundColor: '#1a1a2e',
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      document.body.removeChild(printDiv);
      
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.9);
      });
    } catch (error) {
      console.error('Error generating print:', error);
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 p-4 relative">
      {/* Loading Overlay */}
      {isLoading && loadingMessage && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-lg p-6 shadow-lg flex flex-col items-center gap-4 max-w-sm mx-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <div className="text-center">
              <p className="text-lg font-medium">{loadingMessage}</p>
              <p className="text-sm text-muted-foreground mt-1">Aguarde...</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <Card className="glass-card border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Olá, {user?.username}!</CardTitle>
                <CardDescription>
                  Cadastre ou sincronize seus perfis do Instagram
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {registeredIGs.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {registeredIGs.length} perfil(is)
                  </span>
                )}
                {onLogout && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLogout}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="w-4 h-4 mr-1" />
                    Sair
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Email input - shows locked state if already set in cloud */}
        <Card className={`glass-card ${user?.isEmailLocked ? 'border-primary/20' : 'border-amber-500/20'}`}>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Seu e-mail {user?.isEmailLocked ? '(salvo)' : '(obrigatório)'}
                {user?.isEmailLocked && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    Vinculado
                  </span>
                )}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => !user?.isEmailLocked && setEmail(e.target.value)}
                disabled={user?.isEmailLocked}
                className={`bg-background/50 ${user?.isEmailLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
              />
              <p className="text-xs text-muted-foreground">
                {user?.isEmailLocked 
                  ? 'Este e-mail está vinculado à sua conta e não pode ser alterado'
                  : 'Este e-mail será salvo e vinculado permanentemente à sua conta'
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Main Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Register New Profile */}
          <Card className="glass-card border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Cadastrar Perfil
              </CardTitle>
              <CardDescription>
                Adicione um novo Instagram à sua conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instagram" className="flex items-center gap-2">
                  <Instagram className="w-4 h-4" />
                  Instagram
                </Label>
                <Input
                  id="instagram"
                  type="text"
                  placeholder="@usuario ou link do perfil"
                  value={instagramInput}
                  onChange={(e) => setInstagramInput(e.target.value)}
                  disabled={isLoading}
                  className="bg-background/50"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleSearchProfile}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Buscar e Analisar
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Sync Accounts */}
          <Card className="glass-card border-secondary/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Sincronizar Contas
              </CardTitle>
              <CardDescription>
                Importe perfis já cadastrados na sua conta MRO
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user?.email ? (
                <p className="text-sm text-muted-foreground">
                  E-mail: {user.email}
                </p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="sync-email">E-mail para sincronizar</Label>
                  <Input
                    id="sync-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
              )}
              <Button 
                variant="secondary"
                className="w-full" 
                onClick={handleSyncAccounts}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Sincronizar Contas
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Registered IGs List */}
        {registeredIGs.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Perfis Cadastrados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {registeredIGs.map((ig) => (
                  <div 
                    key={ig}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full text-sm"
                  >
                    <Check className="w-3 h-3 text-primary" />
                    @{ig}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Instagram className="w-5 h-5" />
              Cadastrar este perfil?
            </DialogTitle>
            <DialogDescription>
              Deseja vincular @{pendingProfile?.username} à sua conta MRO?
            </DialogDescription>
          </DialogHeader>
          
          {pendingProfile && (
            <div className="flex items-center gap-4 p-4 bg-secondary/20 rounded-lg">
              <img 
                src={pendingProfile.profilePicUrl} 
                alt={pendingProfile.username}
                className="w-16 h-16 rounded-full object-cover border-2 border-primary"
              />
              <div>
                <p className="font-semibold">@{pendingProfile.username}</p>
                <p className="text-sm text-muted-foreground">{pendingProfile.fullName}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingProfile.followers.toLocaleString()} seguidores
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Ainda não
            </Button>
            <Button onClick={handleConfirmRegistration}>
              Sim, cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning Dialog */}
      <Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
              Atenção!
            </DialogTitle>
            <DialogDescription className="text-base">
              Após cadastrar, você <strong>não poderá remover</strong> este perfil. 
              Ele ficará permanentemente vinculado à sua conta.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="confirm-email">Confirme seu e-mail</Label>
              <Input
                id="confirm-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/50"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Um print dos dados será gerado e enviado junto ao cadastro.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowWarningDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleFinalConfirmation}
              disabled={isLoading}
              className="bg-primary"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                'Confirmar Cadastro'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync Offer Dialog - when profile already exists in SquareCloud */}
      <Dialog open={showSyncOfferDialog} onOpenChange={setShowSyncOfferDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Perfil já vinculado
            </DialogTitle>
            <DialogDescription className="text-base">
              Este perfil já está vinculado à sua conta. Deseja sincronizar agora?
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-4 bg-secondary/20 rounded-lg flex items-center gap-3">
            <Instagram className="w-8 h-8 text-primary" />
            <div>
              <p className="font-medium">@{pendingSyncIG}</p>
              <p className="text-sm text-muted-foreground">
                Será adicionado ao seu painel
              </p>
            </div>
          </div>

          {!user?.email && (
            <div className="space-y-2">
              <Label htmlFor="sync-email-dialog">Seu e-mail</Label>
              <Input
                id="sync-email-dialog"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/50"
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowSyncOfferDialog(false);
                setPendingSyncIG('');
              }}
            >
              Não
            </Button>
            <Button 
              onClick={handleSyncSingleProfile}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                'Sim'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
