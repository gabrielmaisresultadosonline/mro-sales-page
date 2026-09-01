import { useState } from 'react';
import { getAdminData, TutorialModule, ModuleContent, ModuleVideo, ModuleText, getYoutubeThumbnail } from '@/lib/adminConfig';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { Play, Download, X, ChevronLeft, Type } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MROFerramenta = () => {
  const navigate = useNavigate();
  const adminData = getAdminData();
  const [selectedModule, setSelectedModule] = useState<TutorialModule | null>(null);
  const [selectedContent, setSelectedContent] = useState<ModuleContent | null>(null);
  const [showWelcomeVideo, setShowWelcomeVideo] = useState(false);

  const welcomeVideo = adminData.settings.welcomeVideo;

  const getYoutubeEmbedUrl = (url: string): string => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}?autoplay=1`;
    }
    return url;
  };

  const handleContentClick = (content: ModuleContent) => {
    setSelectedContent(content);
  };

  const handleBack = () => {
    if (selectedContent) {
      setSelectedContent(null);
      setSelectedModule(null);
    } else {
      navigate('/');
    }
  };

  // Get video contents with numbering
  const getVideoIndex = (module: TutorialModule, contentId: string): number => {
    const videos = module.contents.filter(c => c.type === 'video');
    return videos.findIndex(v => v.id === contentId) + 1;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-card border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={handleBack} 
                className="cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
              <Logo size="sm" />
              <span className="text-sm font-medium text-primary">MRO Ferramenta</span>
            </div>

            {adminData.settings.downloadLink && (
              <Button 
                type="button"
                variant="gradient" 
                size="sm"
                onClick={() => window.open(adminData.settings.downloadLink, '_blank')}
                className="cursor-pointer"
              >
                <Download className="w-4 h-4 mr-2" />
                Download MRO
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          
          {/* Welcome Video Section */}
          {welcomeVideo?.enabled && welcomeVideo.youtubeUrl && !selectedModule && (
            <div className="mb-10">
              {welcomeVideo.showTitle && welcomeVideo.title && (
                <h2 className="text-2xl font-display font-bold mb-4">{welcomeVideo.title}</h2>
              )}
              <div 
                className="relative aspect-video max-w-3xl mx-auto rounded-xl overflow-hidden cursor-pointer group shadow-lg border border-border"
                onClick={() => setShowWelcomeVideo(true)}
              >
                {welcomeVideo.coverUrl ? (
                  <img 
                    src={welcomeVideo.coverUrl}
                    alt={welcomeVideo.title || 'Vídeo de boas-vindas'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <img 
                    src={getYoutubeThumbnail(welcomeVideo.youtubeUrl)}
                    alt={welcomeVideo.title || 'Vídeo de boas-vindas'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
                {/* Play Button Overlay */}
                <div className="absolute inset-0 bg-background/40 flex items-center justify-center group-hover:bg-background/50 transition-colors">
                  <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                    <Play className="w-10 h-10 text-white ml-1" fill="white" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Module List View - Modules as containers with content inside */}
          {!selectedModule && (
            <>
              <h1 className="text-3xl font-display font-bold mb-2">Módulos</h1>
              <p className="text-muted-foreground mb-8">Aprenda a usar a ferramenta MRO Inteligente</p>

              {adminData.modules.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <Play className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum módulo disponível ainda</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {adminData.modules.sort((a, b) => a.order - b.order).map((module) => (
                    <div 
                      key={module.id}
                      className="glass-card p-6 rounded-xl border border-border"
                    >
                      {/* Module Header */}
                      <div className="flex items-center gap-4 mb-6">
                        {module.showNumber && (
                          <span className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center text-xl font-bold shadow-lg">
                            {module.order}
                          </span>
                        )}
                        <div>
                          <h2 className="text-xl md:text-2xl font-display font-bold">{module.title}</h2>
                          {module.description && (
                            <p className="text-muted-foreground mt-1">{module.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Module Contents Grid */}
                      {module.contents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Play className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>Nenhum conteúdo neste módulo</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                          {module.contents.sort((a, b) => a.order - b.order).map((content, idx) => (
                            <div 
                              key={content.id}
                              className="group cursor-pointer"
                              onClick={() => {
                                setSelectedModule(module);
                                handleContentClick(content);
                              }}
                            >
                              {content.type === 'video' ? (
                                <>
                                  {/* Aspect ratio 1080x1350 = 4:5 */}
                                  <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-secondary border-2 border-transparent group-hover:border-primary transition-all duration-300">
                                    <img 
                                      src={(content as ModuleVideo).thumbnailUrl || getYoutubeThumbnail((content as ModuleVideo).youtubeUrl)}
                                      alt={content.title}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      onError={(e) => {
                                        e.currentTarget.src = 'https://via.placeholder.com/1080x1350?text=Video';
                                      }}
                                    />
                                    
                                    {/* Number badge - red circle in corner */}
                                    {(content as ModuleVideo).showNumber && (
                                      <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-bold shadow-lg">
                                        {getVideoIndex(module, content.id)}
                                      </div>
                                    )}

                                    {/* Play overlay */}
                                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                                        <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-gradient-to-br from-secondary to-muted flex items-center justify-center border-2 border-transparent group-hover:border-primary transition-all duration-300">
                                  <Type className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                  {/* Number badge - red circle in corner */}
                                  <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-bold shadow-lg">
                                    {idx + 1}
                                  </div>
                                </div>
                              )}
                              <h3 className="font-medium mt-2 text-sm group-hover:text-primary transition-colors line-clamp-2">{content.title}</h3>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </main>

      {/* Welcome Video Lightbox */}
      {showWelcomeVideo && welcomeVideo?.youtubeUrl && (
        <div 
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowWelcomeVideo(false)}
        >
          <div 
            className="w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">{welcomeVideo.title || 'Boas-vindas'}</h3>
              <Button 
                type="button"
                variant="ghost" 
                size="sm" 
                onClick={() => setShowWelcomeVideo(false)}
                className="cursor-pointer"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                src={getYoutubeEmbedUrl(welcomeVideo.youtubeUrl)}
                title={welcomeVideo.title || 'Vídeo de boas-vindas'}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* Content Lightbox */}
      {selectedContent && (
        <div 
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedContent(null)}
        >
          <div 
            className="w-full max-w-5xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">{selectedContent.title}</h3>
              <Button 
                type="button"
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedContent(null)}
                className="cursor-pointer"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {selectedContent.type === 'video' ? (
              <>
                <div className="aspect-video rounded-lg overflow-hidden bg-black">
                  <iframe
                    src={getYoutubeEmbedUrl((selectedContent as ModuleVideo).youtubeUrl)}
                    title={selectedContent.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                {(selectedContent as ModuleVideo).description && (
                  <p className="text-muted-foreground mt-4">{(selectedContent as ModuleVideo).description}</p>
                )}
              </>
            ) : (
              <div className="glass-card p-6 rounded-lg">
                <div className="prose prose-invert max-w-none">
                  {(selectedContent as ModuleText).content.split('\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-4 last:mb-0 text-foreground">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MROFerramenta;
