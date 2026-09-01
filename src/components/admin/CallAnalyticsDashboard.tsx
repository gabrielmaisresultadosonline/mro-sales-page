import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getAdminData, saveAdminData, getCallAnalytics, clearCallAnalytics, CallAnalytics } from '@/lib/adminConfig';
import { 
  Phone, PhoneCall, PhoneOff, ExternalLink, Eye, 
  Trash2, BarChart3, TrendingUp, Clock, Users,
  Smartphone, Monitor, RefreshCw, Code
} from 'lucide-react';

const CallAnalyticsDashboard = () => {
  const { toast } = useToast();
  const [adminData, setAdminData] = useState(getAdminData());
  const [analytics, setAnalytics] = useState<CallAnalytics[]>([]);

  useEffect(() => {
    setAnalytics(getCallAnalytics());
  }, []);

  const refreshAnalytics = () => {
    setAnalytics(getCallAnalytics());
    toast({ title: "Analytics atualizados!" });
  };

  const handleClearAnalytics = () => {
    if (confirm('Tem certeza que deseja limpar todos os dados de analytics?')) {
      clearCallAnalytics();
      setAnalytics([]);
      toast({ title: "Analytics limpos!", description: "Todos os dados foram removidos." });
    }
  };

  const handleSaveSettings = () => {
    saveAdminData(adminData);
    toast({ title: "Configurações salvas!" });
  };

  const updatePixelSettings = (key: keyof typeof adminData.settings.callPixelEvents, value: boolean) => {
    setAdminData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        callPixelEvents: {
          ...prev.settings.callPixelEvents,
          [key]: value
        }
      }
    }));
  };

  // Calculate stats
  const stats = {
    pageViews: analytics.filter(a => a.event === 'page_view').length,
    ringtoneStarted: analytics.filter(a => a.event === 'ringtone_started').length,
    callsAnswered: analytics.filter(a => a.event === 'call_answered').length,
    audioCompleted: analytics.filter(a => a.event === 'audio_completed').length,
    ctaClicked: analytics.filter(a => a.event === 'cta_clicked').length,
  };

  // Calculate conversion rates
  const answerRate = stats.ringtoneStarted > 0 ? ((stats.callsAnswered / stats.ringtoneStarted) * 100).toFixed(1) : '0';
  const completionRate = stats.callsAnswered > 0 ? ((stats.audioCompleted / stats.callsAnswered) * 100).toFixed(1) : '0';
  const ctaRate = stats.audioCompleted > 0 ? ((stats.ctaClicked / stats.audioCompleted) * 100).toFixed(1) : '0';

  // Device breakdown
  const isMobile = (ua: string) => /iPhone|iPad|iPod|Android/i.test(ua);
  const mobileCount = analytics.filter(a => a.event === 'page_view' && isMobile(a.userAgent)).length;
  const desktopCount = stats.pageViews - mobileCount;

  // Get recent events (last 20)
  const recentEvents = [...analytics].reverse().slice(0, 20);

  const getEventIcon = (event: CallAnalytics['event']) => {
    switch (event) {
      case 'page_view': return <Eye className="w-4 h-4 text-blue-500" />;
      case 'ringtone_started': return <Phone className="w-4 h-4 text-yellow-500" />;
      case 'call_answered': return <PhoneCall className="w-4 h-4 text-green-500" />;
      case 'audio_completed': return <PhoneOff className="w-4 h-4 text-purple-500" />;
      case 'cta_clicked': return <ExternalLink className="w-4 h-4 text-primary" />;
    }
  };

  const getEventLabel = (event: CallAnalytics['event']) => {
    switch (event) {
      case 'page_view': return 'Visualização';
      case 'ringtone_started': return 'Toque iniciado';
      case 'call_answered': return 'Atendeu';
      case 'audio_completed': return 'Ouviu tudo';
      case 'cta_clicked': return 'Clicou CTA';
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="glass-card p-4 text-center">
          <Eye className="w-6 h-6 mx-auto text-blue-500 mb-2" />
          <p className="text-2xl font-bold">{stats.pageViews}</p>
          <p className="text-xs text-muted-foreground">Visualizações</p>
        </div>
        <div className="glass-card p-4 text-center">
          <Phone className="w-6 h-6 mx-auto text-yellow-500 mb-2" />
          <p className="text-2xl font-bold">{stats.ringtoneStarted}</p>
          <p className="text-xs text-muted-foreground">Toques Iniciados</p>
        </div>
        <div className="glass-card p-4 text-center">
          <PhoneCall className="w-6 h-6 mx-auto text-green-500 mb-2" />
          <p className="text-2xl font-bold">{stats.callsAnswered}</p>
          <p className="text-xs text-muted-foreground">Atenderam</p>
        </div>
        <div className="glass-card p-4 text-center">
          <PhoneOff className="w-6 h-6 mx-auto text-purple-500 mb-2" />
          <p className="text-2xl font-bold">{stats.audioCompleted}</p>
          <p className="text-xs text-muted-foreground">Ouviram Tudo</p>
        </div>
        <div className="glass-card p-4 text-center">
          <ExternalLink className="w-6 h-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">{stats.ctaClicked}</p>
          <p className="text-xs text-muted-foreground">Clicaram CTA</p>
        </div>
      </div>

      {/* Conversion Rates & Device Breakdown */}
      <div className="grid grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Taxas de Conversão
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Taxa de Atendimento</span>
                <span className="font-bold text-green-500">{answerRate}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all" 
                  style={{ width: `${answerRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Taxa de Conclusão do Áudio</span>
                <span className="font-bold text-purple-500">{completionRate}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 transition-all" 
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Taxa de Clique no CTA</span>
                <span className="font-bold text-primary">{ctaRate}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all" 
                  style={{ width: `${ctaRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Dispositivos
          </h3>
          <div className="flex items-center justify-around">
            <div className="text-center">
              <Smartphone className="w-10 h-10 mx-auto text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{mobileCount}</p>
              <p className="text-xs text-muted-foreground">Mobile</p>
            </div>
            <div className="text-center">
              <Monitor className="w-10 h-10 mx-auto text-green-500 mb-2" />
              <p className="text-2xl font-bold">{desktopCount}</p>
              <p className="text-xs text-muted-foreground">Desktop</p>
            </div>
          </div>
          {stats.pageViews > 0 && (
            <div className="mt-4">
              <div className="flex gap-2 h-4 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 transition-all" 
                  style={{ width: `${(mobileCount / stats.pageViews) * 100}%` }}
                />
                <div 
                  className="bg-green-500 transition-all" 
                  style={{ width: `${(desktopCount / stats.pageViews) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{((mobileCount / stats.pageViews) * 100).toFixed(0)}% Mobile</span>
                <span>{((desktopCount / stats.pageViews) * 100).toFixed(0)}% Desktop</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Facebook Pixel Settings */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Configurações do Facebook Pixel
        </h3>
        
        <div className="space-y-6">
          {/* Pixel ID */}
          <div className="space-y-2">
            <Label htmlFor="pixelId">Pixel ID (referência)</Label>
            <Input
              id="pixelId"
              value={adminData.settings.facebookPixel}
              onChange={(e) => setAdminData(prev => ({
                ...prev,
                settings: { ...prev.settings, facebookPixel: e.target.value }
              }))}
              placeholder="ID do Pixel do Facebook"
              className="bg-secondary/50"
            />
          </div>

          {/* Complete Pixel Code */}
          <div className="space-y-2">
            <Label htmlFor="pixelCode" className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              Código Completo do Pixel (cole apenas o JavaScript)
            </Label>
            <Textarea
              id="pixelCode"
              value={adminData.settings.facebookPixelCode || ''}
              onChange={(e) => setAdminData(prev => ({
                ...prev,
                settings: { ...prev.settings, facebookPixelCode: e.target.value }
              }))}
              placeholder={`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'SEU_PIXEL_ID');
fbq('track', 'PageView');`}
              className="bg-secondary/50 font-mono text-xs min-h-[200px]"
              rows={10}
            />
            <p className="text-xs text-muted-foreground">
              Cole o código JavaScript do Meta Pixel (sem as tags &lt;script&gt;). 
              Este código será injetado diretamente na página /ligacao.
            </p>
          </div>

          {/* Events Info */}
          <div className="bg-secondary/30 p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Eventos Rastreados:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• <span className="text-green-500 font-medium">PageView</span> - Disparado ao carregar a página /ligacao</li>
              <li>• <span className="text-green-500 font-medium">ViewContent</span> - Disparado quando clica no botão final após ouvir o áudio</li>
            </ul>
          </div>
        </div>

        <Button onClick={handleSaveSettings} className="mt-4 cursor-pointer">
          Salvar Configurações
        </Button>
      </div>

      {/* Recent Events */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Eventos Recentes
          </h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refreshAnalytics} className="cursor-pointer">
              <RefreshCw className="w-4 h-4 mr-1" />
              Atualizar
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClearAnalytics} className="cursor-pointer">
              <Trash2 className="w-4 h-4 mr-1" />
              Limpar Tudo
            </Button>
          </div>
        </div>
        
        {recentEvents.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum evento registrado ainda. Os eventos aparecerão quando usuários acessarem /ligacao.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {recentEvents.map((event) => (
              <div 
                key={event.id}
                className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg"
              >
                {getEventIcon(event.event)}
                <div className="flex-1">
                  <p className="text-sm font-medium">{getEventLabel(event.event)}</p>
                  <p className="text-xs text-muted-foreground">
                    {isMobile(event.userAgent) ? '📱 Mobile' : '💻 Desktop'}
                    {event.referrer && event.referrer !== 'direct' && ` • via ${event.referrer}`}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(event.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallAnalyticsDashboard;
