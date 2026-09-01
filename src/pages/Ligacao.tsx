import { useState, useRef, useEffect } from 'react';
import { Check, X, ExternalLink, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackCallEvent, getAdminData } from '@/lib/adminConfig';
import profileImage from '@/assets/mro-profile-call.jpg';
import fundoChamada from '@/assets/fundo-chamada.jpg';
import gabrielImage from '@/assets/gabriel-transparente.png';

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

const Ligacao = () => {
  const [callState, setCallState] = useState<'landing' | 'ringing' | 'connected' | 'ended'>('landing');
  const [callDuration, setCallDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const ringtoneVideoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get admin settings for pixel configuration
  const adminSettings = getAdminData().settings;

  // Track page view in local analytics on mount (Pixel PageView already fires from index.html)
  useEffect(() => {
    trackCallEvent('page_view');
    console.log('[Ligacao] Page loaded - FB Pixel PageView already fired from index.html');
  }, []);

  // Force larger zoom on desktop to fill screen better
  useEffect(() => {
    const isDesktop = window.innerWidth > 768;
    if (isDesktop) {
      // Store original zoom
      const originalZoom = (document.body.style as any).zoom || '100%';
      // Force 125% zoom to make content bigger on desktop
      (document.body.style as any).zoom = '125%';
      
      return () => {
        // Restore original zoom on unmount
        (document.body.style as any).zoom = originalZoom;
      };
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
      if (ringtoneVideoRef.current) {
        ringtoneVideoRef.current.pause();
        ringtoneVideoRef.current.currentTime = 0;
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      navigator.vibrate?.(0);
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // User clicks "Receber chamada" - this is the first user interaction
  // Use it to unlock audio context on iOS
  const handleReceiveCall = () => {
    // Create and play a silent audio to unlock audio context on iOS
    const silentAudio = new Audio();
    silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    silentAudio.play().catch(() => {});
    
    // Play ringtone video (audio only, video invisible) with user gesture
    if (ringtoneVideoRef.current) {
      ringtoneVideoRef.current.loop = true;
      ringtoneVideoRef.current.volume = 1;
      ringtoneVideoRef.current.muted = false;
      ringtoneVideoRef.current.play().catch(() => {});
    }
    
    // Start vibration
    if ('vibrate' in navigator) {
      navigator.vibrate([500, 300, 500, 300, 500]);
      vibrationIntervalRef.current = setInterval(() => {
        navigator.vibrate([500, 300, 500, 300, 500]);
      }, 2500);
    }
    
    // Track ringtone started
    trackCallEvent('ringtone_started');
    
    setCallState('ringing');
  };

  // User clicks "Accept" - use this interaction to authorize call audio
  const handleAnswer = () => {
    // Stop ringtone video
    if (ringtoneVideoRef.current) {
      ringtoneVideoRef.current.pause();
      ringtoneVideoRef.current.currentTime = 0;
    }

    // Stop vibration
    navigator.vibrate?.(0);
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }

    // Change state
    setCallState('connected');

    // Start call duration timer
    intervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    // Track call answered
    trackCallEvent('call_answered');

    // Play call audio IMMEDIATELY with this user gesture (critical for iOS)
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 1;
      // This play() is triggered by user tap, so it should work on iOS
      audioRef.current.play().catch(() => {});
    }
  };

  const handleAudioEnded = () => {
    setCallState('ended');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Track audio completed - user listened to everything
    trackCallEvent('audio_completed');
  };

  const handleAccessSite = () => {
    // Track CTA clicked
    trackCallEvent('cta_clicked');
    
    // Fire Facebook Pixel ViewContent event (visualização de conteúdo)
    if (window.fbq) {
      window.fbq('track', 'ViewContent', { 
        content_name: 'ligacao_cta_clicked',
        content_category: 'call_funnel'
      });
    }
    
    window.location.href = 'https://acessar.click/mrointeligente';
  };

  // Common fullscreen container style
  const fullscreenStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    margin: 0,
    padding: 0,
    overflow: 'hidden',
  };

  return (
    <>
      {/* Hidden video for ringtone - plays audio only */}
      <video 
        ref={ringtoneVideoRef} 
        src="/ringtone.mp4"
        preload="auto"
        playsInline
        webkit-playsinline="true"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
      <audio 
        ref={audioRef} 
        src="/call-audio.mp3"
        onEnded={handleAudioEnded}
        preload="auto"
        playsInline
        webkit-playsinline="true"
      />

      {/* Landing Page */}
      {callState === 'landing' && (
        <div 
          style={{
            ...fullscreenStyle,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingTop: 'max(2rem, env(safe-area-inset-top))',
            backgroundImage: `url(${fundoChamada})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: '#000',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
          
          <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 1rem', textAlign: 'center' }}>
            <img 
              src={gabrielImage} 
              alt="Gabriel"
              style={{ width: '12rem', height: 'auto', marginBottom: '-2.5rem' }}
            />

            <h1 style={{ color: '#fff', fontSize: '1.125rem', fontWeight: 'bold', fontStyle: 'italic', lineHeight: 1.3, marginBottom: '1rem', maxWidth: '280px' }}>
              <span style={{ color: '#facc15' }}>Gabriel</span> esta agora
              <br />disponível para uma
              <br />chamada, atenda para
              <br />entender <span style={{ color: '#facc15' }}>como não Gastar
              <br />mais com anúncios!</span>
            </h1>

            <button
              onClick={handleReceiveCall}
              style={{
                backgroundColor: '#4ade80',
                color: '#000',
                fontWeight: 'bold',
                padding: '0.75rem 1.5rem',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '1rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 10px 15px -3px rgba(74, 222, 128, 0.3)',
              }}
            >
              Receber chamada agora
              <Phone style={{ width: '1.25rem', height: '1.25rem' }} />
            </button>
          </div>
        </div>
      )}

      {/* Ringing State */}
      {callState === 'ringing' && (
        <div style={{ ...fullscreenStyle, display: 'flex', flexDirection: 'column', backgroundColor: '#000' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
            <button style={{ color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none' }}>
              <svg style={{ width: '1.75rem', height: '1.75rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6,9 12,15 18,9" />
              </svg>
            </button>
            <button style={{ color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none' }}>
              <svg style={{ width: '1.25rem', height: '1.25rem' }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </button>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2rem', paddingLeft: '2rem', paddingRight: '2rem' }}>
            <div style={{ width: '5rem', height: '5rem', borderRadius: '50%', overflow: 'hidden', marginBottom: '0.75rem', border: '2px solid rgba(255,255,255,0.2)' }}>
              <img src={profileImage} alt="Mais Resultados Online" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              <span>Áudio de Instagram...</span>
            </div>

            <h1 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 600 }}>
              @maisresultadosonline
            </h1>
          </div>

          <div style={{ paddingBottom: 'max(5rem, calc(env(safe-area-inset-bottom) + 3rem))', paddingLeft: '2rem', paddingRight: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '280px', margin: '0 auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button 
                  style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, cursor: 'not-allowed', border: 'none' }}
                  disabled
                >
                  <X style={{ width: '1.75rem', height: '1.75rem', color: '#fff' }} />
                </button>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginTop: '0.5rem' }}>Recusar</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button
                  onClick={handleAnswer}
                  style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', backgroundColor: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.3)' }}
                >
                  <Check style={{ width: '1.75rem', height: '1.75rem', color: '#fff' }} />
                </button>
                <span style={{ color: '#fff', fontSize: '0.75rem', marginTop: '0.5rem' }}>Aceitar</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connected State */}
      {callState === 'connected' && (
        <div style={{ ...fullscreenStyle, display: 'flex', flexDirection: 'column', background: 'linear-gradient(to bottom, #3d2c2c, #2a1f1f, #1a1212)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
            <button style={{ color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none' }}>
              <svg style={{ width: '1.75rem', height: '1.75rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6,9 12,15 18,9" />
              </svg>
            </button>
            <button style={{ color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none' }}>
              <svg style={{ width: '1.25rem', height: '1.25rem' }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </button>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '3rem', paddingLeft: '2rem', paddingRight: '2rem' }}>
            <div style={{ width: '5rem', height: '5rem', borderRadius: '50%', overflow: 'hidden', marginBottom: '0.75rem', border: '2px solid rgba(255,255,255,0.2)' }}>
              <img src={profileImage} alt="Mais Resultados Online" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', textAlign: 'center', marginBottom: '0.25rem' }}>
              Chamada ativa em andamento...
            </p>
            <p style={{ color: '#fff', fontSize: '0.875rem', fontWeight: 500 }}>
              {formatDuration(callDuration)}
            </p>
          </div>

          <div style={{ paddingBottom: 'max(5rem, calc(env(safe-area-inset-bottom) + 3rem))', paddingLeft: '1rem', paddingRight: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
              <button style={{ width: '2.75rem', height: '2.75rem', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}>
                <svg style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="6" width="14" height="12" rx="2"/>
                  <path d="M22 8l-6 4 6 4V8z"/>
                  <line x1="2" y1="2" x2="22" y2="22" strokeLinecap="round"/>
                </svg>
              </button>

              <button style={{ width: '2.75rem', height: '2.75rem', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}>
                <svg style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
                </svg>
              </button>

              <button style={{ width: '2.75rem', height: '2.75rem', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}>
                <svg style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 11.5V13H9v2.5L5.5 12 9 8.5V11h6V8.5l3.5 3.5-3.5 3.5z"/>
                </svg>
              </button>

              <button style={{ width: '2.75rem', height: '2.75rem', borderRadius: '50%', backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}>
                <svg style={{ width: '1.25rem', height: '1.25rem', color: '#fff', transform: 'rotate(135deg)' }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ended State */}
      {callState === 'ended' && (
        <div style={{ ...fullscreenStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 'max(3rem, env(safe-area-inset-top))', paddingLeft: '1.5rem', paddingRight: '1.5rem', backgroundColor: '#000' }}>
          <div style={{ width: '6rem', height: '6rem', borderRadius: '50%', overflow: 'hidden', marginBottom: '1rem', border: '2px solid #eab308' }}>
            <img src={profileImage} alt="Mais Resultados Online" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 600, textAlign: 'center', marginBottom: '0.5rem' }}>
            Ligação encerrada!
          </h2>

          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Duração: {formatDuration(callDuration)}
          </p>

          <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem', width: '100%', maxWidth: '320px' }}>
            <p style={{ color: '#fde047', fontSize: '1rem', fontWeight: 600, textAlign: 'center', marginBottom: '0.5rem' }}>
              🔥 Aproveite agora mesmo!
            </p>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', textAlign: 'center' }}>
              Planos a partir de <span style={{ color: '#4ade80', fontWeight: 'bold' }}>R$33 mensal</span>
            </p>
          </div>

          <button
            onClick={handleAccessSite}
            style={{
              backgroundColor: '#eab308',
              color: '#000',
              fontWeight: 'bold',
              padding: '1rem 2rem',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 10px 15px -3px rgba(234, 179, 8, 0.3)',
            }}
          >
            Acessar o site agora
            <ExternalLink style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>

          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '1rem', textAlign: 'center' }}>
            @maisresultadosonline
          </p>
        </div>
      )}
    </>
  );
};

export default Ligacao;
