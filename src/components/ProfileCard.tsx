import { InstagramProfile } from '@/types/instagram';
import { Users, UserPlus, Grid3X3, ExternalLink, Briefcase } from 'lucide-react';

interface ProfileCardProps {
  profile: InstagramProfile;
}

export const ProfileCard = ({ profile }: ProfileCardProps) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="glass-card glow-border p-6 animate-slide-up">
      <div className="flex items-start gap-6">
        {/* Profile Picture */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-primary/30">
            <img 
              src={profile.profilePicUrl} 
              alt={profile.fullName}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${profile.username}&backgroundColor=10b981`;
              }}
            />
          </div>
          {profile.isBusinessAccount && (
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-primary-foreground" />
            </div>
          )}
        </div>

        {/* Profile Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-display font-bold">@{profile.username}</h2>
            {profile.category && (
              <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium">
                {profile.category}
              </span>
            )}
          </div>
          <p className="text-lg text-foreground/90 mb-2">{profile.fullName}</p>
          <p className="text-muted-foreground text-sm whitespace-pre-line">{profile.bio}</p>
          
          {profile.externalUrl && (
            <a 
              href={profile.externalUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 text-primary hover:underline text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              {profile.externalUrl}
            </a>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
        <StatItem icon={<Grid3X3 />} value={formatNumber(profile.posts)} label="Posts" />
        <StatItem icon={<Users />} value={formatNumber(profile.followers)} label="Seguidores" />
        <StatItem icon={<UserPlus />} value={formatNumber(profile.following)} label="Seguindo" />
      </div>

      {/* Engagement */}
      <div className="mt-6 p-4 rounded-lg bg-secondary/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Taxa de Engajamento</p>
            <p className="text-2xl font-display font-bold text-gradient">{profile.engagement.toFixed(2)}%</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Média por Post</p>
            <p className="text-foreground">
              <span className="font-semibold">{formatNumber(profile.avgLikes)}</span> likes • 
              <span className="font-semibold ml-1">{formatNumber(profile.avgComments)}</span> comentários
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatItem = ({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) => (
  <div className="text-center">
    <div className="flex items-center justify-center gap-2 mb-1">
      <span className="text-primary">{icon}</span>
      <span className="text-2xl font-display font-bold">{value}</span>
    </div>
    <p className="text-sm text-muted-foreground">{label}</p>
  </div>
);
