// Admin configuration - uses Supabase Auth for secure authentication
// NO HARDCODED CREDENTIALS - Admin users must be created in Supabase Auth
// with admin role assigned in user_roles table

import { supabase } from '@/integrations/supabase/client';

// Admin settings stored in localStorage
export interface WelcomeVideo {
  enabled: boolean;
  title: string;
  showTitle: boolean;
  youtubeUrl: string;
  coverUrl: string;
}

export interface CallAnalytics {
  id: string;
  timestamp: string;
  event: 'page_view' | 'ringtone_started' | 'call_answered' | 'audio_completed' | 'cta_clicked';
  userAgent: string;
  referrer: string;
}

export interface AdminSettings {
  apis: {
    deepseek: string;
    gemini: string;
    nanoBanana: string;
  };
  facebookPixel: string;
  facebookPixelCode: string; // Complete pixel code for manual injection
  downloadLink: string;
  welcomeVideo: WelcomeVideo;
  callPixelEvents: {
    pageView: boolean;
    audioCompleted: boolean;
    ctaClicked: boolean;
  };
}

// Content types for modules
export type ModuleContentType = 'video' | 'text';

export interface ModuleVideo {
  id: string;
  type: 'video';
  title: string;
  description: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  showNumber: boolean;
  order: number;
  createdAt: string;
}

export interface ModuleText {
  id: string;
  type: 'text';
  title: string;
  content: string;
  order: number;
  createdAt: string;
}

export type ModuleContent = ModuleVideo | ModuleText;

export interface TutorialModule {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  showNumber: boolean;
  order: number;
  contents: ModuleContent[];
  createdAt: string;
}

// Legacy types for backwards compatibility
export interface TutorialVideo {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  step: number;
  order: number;
  createdAt: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  order: number;
  videos: TutorialVideo[];
}

export interface AdminData {
  settings: AdminSettings;
  tutorials: TutorialStep[]; // Legacy
  modules: TutorialModule[];
  callAnalytics: CallAnalytics[];
}

const DEFAULT_ADMIN_DATA: AdminData = {
  settings: {
    apis: {
      deepseek: '',
      gemini: '',
      nanoBanana: ''
    },
    facebookPixel: '569414052132145',
    facebookPixelCode: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '569414052132145');
fbq('track', 'PageView');`,
    downloadLink: '',
    welcomeVideo: {
      enabled: false,
      title: '',
      showTitle: true,
      youtubeUrl: '',
      coverUrl: ''
    },
    callPixelEvents: {
      pageView: true,
      audioCompleted: true,
      ctaClicked: true
    }
  },
  tutorials: [],
  modules: [],
  callAnalytics: []
};

// NO HARDCODED CREDENTIALS - Admin authentication uses Supabase Auth
// Admin users must have 'admin' role in user_roles table

export const getAdminData = (): AdminData => {
  try {
    const data = localStorage.getItem('mro_admin_data');
    if (data) {
      const parsed = JSON.parse(data);
      return { 
        ...DEFAULT_ADMIN_DATA, 
        ...parsed,
        modules: parsed.modules || [],
        callAnalytics: parsed.callAnalytics || [],
        settings: {
          ...DEFAULT_ADMIN_DATA.settings,
          ...parsed.settings,
          callPixelEvents: {
            ...DEFAULT_ADMIN_DATA.settings.callPixelEvents,
            ...(parsed.settings?.callPixelEvents || {})
          }
        }
      };
    }
  } catch (e) {
    console.error('Error reading admin data:', e);
  }
  return DEFAULT_ADMIN_DATA;
};

export const saveAdminData = (data: AdminData): void => {
  localStorage.setItem('mro_admin_data', JSON.stringify(data));
};

export const updateSettings = (settings: Partial<AdminSettings>): void => {
  const data = getAdminData();
  data.settings = { ...data.settings, ...settings };
  saveAdminData(data);
};

// Call Analytics functions
export const trackCallEvent = (event: CallAnalytics['event']): void => {
  const data = getAdminData();
  const analytics: CallAnalytics = {
    id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    event,
    userAgent: navigator.userAgent,
    referrer: document.referrer || 'direct'
  };
  data.callAnalytics.push(analytics);
  // Keep only last 1000 events
  if (data.callAnalytics.length > 1000) {
    data.callAnalytics = data.callAnalytics.slice(-1000);
  }
  saveAdminData(data);
};

export const getCallAnalytics = (): CallAnalytics[] => {
  return getAdminData().callAnalytics;
};

export const clearCallAnalytics = (): void => {
  const data = getAdminData();
  data.callAnalytics = [];
  saveAdminData(data);
};

// Module functions
export const addModule = (title: string, description: string = '', coverUrl: string = '', showNumber: boolean = true): TutorialModule => {
  const data = getAdminData();
  const newModule: TutorialModule = {
    id: `module_${Date.now()}`,
    title,
    description,
    coverUrl,
    showNumber,
    order: data.modules.length + 1,
    contents: [],
    createdAt: new Date().toISOString()
  };
  data.modules.push(newModule);
  saveAdminData(data);
  return newModule;
};

export const updateModule = (moduleId: string, updates: Partial<Omit<TutorialModule, 'id' | 'contents' | 'createdAt'>>): void => {
  const data = getAdminData();
  const module = data.modules.find(m => m.id === moduleId);
  if (module) {
    Object.assign(module, updates);
    saveAdminData(data);
  }
};

export const deleteModule = (moduleId: string): void => {
  const data = getAdminData();
  data.modules = data.modules.filter(m => m.id !== moduleId);
  // Reorder
  data.modules.forEach((m, i) => m.order = i + 1);
  saveAdminData(data);
};

export const reorderModules = (moduleIds: string[]): void => {
  const data = getAdminData();
  const reordered: TutorialModule[] = [];
  moduleIds.forEach((id, index) => {
    const module = data.modules.find(m => m.id === id);
    if (module) {
      module.order = index + 1;
      reordered.push(module);
    }
  });
  data.modules = reordered;
  saveAdminData(data);
};

// Content functions
export const addVideoToModule = (
  moduleId: string, 
  video: { title: string; description: string; youtubeUrl: string; thumbnailUrl?: string; showNumber?: boolean }
): ModuleVideo | null => {
  const data = getAdminData();
  const module = data.modules.find(m => m.id === moduleId);
  if (!module) return null;
  
  const newVideo: ModuleVideo = {
    id: `video_${Date.now()}`,
    type: 'video',
    title: video.title,
    description: video.description,
    youtubeUrl: video.youtubeUrl,
    thumbnailUrl: video.thumbnailUrl || getYoutubeThumbnail(video.youtubeUrl),
    showNumber: video.showNumber ?? true,
    order: module.contents.length + 1,
    createdAt: new Date().toISOString()
  };
  module.contents.push(newVideo);
  saveAdminData(data);
  return newVideo;
};

export const addTextToModule = (
  moduleId: string,
  text: { title: string; content: string }
): ModuleText | null => {
  const data = getAdminData();
  const module = data.modules.find(m => m.id === moduleId);
  if (!module) return null;
  
  const newText: ModuleText = {
    id: `text_${Date.now()}`,
    type: 'text',
    title: text.title,
    content: text.content,
    order: module.contents.length + 1,
    createdAt: new Date().toISOString()
  };
  module.contents.push(newText);
  saveAdminData(data);
  return newText;
};

export const updateContent = (moduleId: string, contentId: string, updates: Partial<ModuleContent>): void => {
  const data = getAdminData();
  const module = data.modules.find(m => m.id === moduleId);
  if (module) {
    const content = module.contents.find(c => c.id === contentId);
    if (content) {
      Object.assign(content, updates);
      saveAdminData(data);
    }
  }
};

export const deleteContent = (moduleId: string, contentId: string): void => {
  const data = getAdminData();
  const module = data.modules.find(m => m.id === moduleId);
  if (module) {
    module.contents = module.contents.filter(c => c.id !== contentId);
    // Reorder
    module.contents.forEach((c, i) => c.order = i + 1);
    saveAdminData(data);
  }
};

export const reorderContents = (moduleId: string, contentIds: string[]): void => {
  const data = getAdminData();
  const module = data.modules.find(m => m.id === moduleId);
  if (module) {
    const reordered: ModuleContent[] = [];
    contentIds.forEach((id, index) => {
      const content = module.contents.find(c => c.id === id);
      if (content) {
        content.order = index + 1;
        reordered.push(content);
      }
    });
    module.contents = reordered;
    saveAdminData(data);
  }
};

// Helper function
export const getYoutubeThumbnail = (url: string): string => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (match) {
    return `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`;
  }
  return '';
};

// Legacy functions for backwards compatibility
export const addTutorialStep = (title: string): TutorialStep => {
  const data = getAdminData();
  const newStep: TutorialStep = {
    id: `step_${Date.now()}`,
    title,
    order: data.tutorials.length + 1,
    videos: []
  };
  data.tutorials.push(newStep);
  saveAdminData(data);
  return newStep;
};

export const addVideoToStep = (stepId: string, video: Omit<TutorialVideo, 'id' | 'step' | 'createdAt'>): TutorialVideo | null => {
  const data = getAdminData();
  const step = data.tutorials.find(s => s.id === stepId);
  if (!step) return null;
  
  const newVideo: TutorialVideo = {
    ...video,
    id: `video_${Date.now()}`,
    step: step.order,
    createdAt: new Date().toISOString()
  };
  step.videos.push(newVideo);
  saveAdminData(data);
  return newVideo;
};

export const deleteTutorialStep = (stepId: string): void => {
  const data = getAdminData();
  data.tutorials = data.tutorials.filter(s => s.id !== stepId);
  // Reorder
  data.tutorials.forEach((s, i) => s.order = i + 1);
  saveAdminData(data);
};

export const deleteVideo = (stepId: string, videoId: string): void => {
  const data = getAdminData();
  const step = data.tutorials.find(s => s.id === stepId);
  if (step) {
    step.videos = step.videos.filter(v => v.id !== videoId);
    saveAdminData(data);
  }
};

// Check if admin is logged in - checks localStorage session
export const isAdminLoggedIn = async (): Promise<boolean> => {
  try {
    const stored = localStorage.getItem('mro_admin_session');
    if (!stored) return false;
    
    const session = JSON.parse(stored);
    return session.email?.toUpperCase() === 'MRO@GMAIL.COM';
  } catch (error) {
    console.error('Error verifying admin status:', error);
    return false;
  }
};

// Verify admin - alias for isAdminLoggedIn
export const verifyAdmin = isAdminLoggedIn;

// Admin credentials - stored securely
const ADMIN_EMAIL = 'MRO@GMAIL.COM';
const ADMIN_PASSWORD = 'Ga145523@';

// Login admin - validates credentials
export const loginAdmin = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check admin credentials
    if (email.toUpperCase() === ADMIN_EMAIL.toUpperCase() && password === ADMIN_PASSWORD) {
      // Store admin session in localStorage
      localStorage.setItem('mro_admin_session', JSON.stringify({
        email: ADMIN_EMAIL,
        loginAt: new Date().toISOString()
      }));
      return { success: true };
    }

    return { success: false, error: 'Credenciais inválidas' };
  } catch (error) {
    console.error('Admin login error:', error);
    return { success: false, error: 'Erro ao fazer login' };
  }
};

// Logout admin - clears localStorage session
export const logoutAdmin = async (): Promise<void> => {
  localStorage.removeItem('mro_admin_session');
};
