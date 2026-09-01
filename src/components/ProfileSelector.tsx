import { ProfileSession } from '@/types/instagram';
import { Plus, User, X, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProfileSelectorProps {
  profiles: ProfileSession[];
  activeProfileId: string | null;
  onSelectProfile: (profileId: string) => void;
  onAddProfile: () => void;
  onRemoveProfile: (profileId: string) => void;
  isLoading?: boolean;
}

export const ProfileSelector = ({
  profiles,
  activeProfileId,
  onSelectProfile,
  onAddProfile,
  onRemoveProfile,
  isLoading,
}: ProfileSelectorProps) => {
  const activeProfile = profiles.find(p => p.id === activeProfileId);

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2" disabled={isLoading}>
            {activeProfile ? (
              <>
                <img
                  src={activeProfile.profile.profilePicUrl}
                  alt={activeProfile.profile.username}
                  className="w-5 h-5 rounded-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <span className="max-w-[120px] truncate">@{activeProfile.profile.username}</span>
              </>
            ) : (
              <>
                <User className="w-4 h-4" />
                <span>Selecionar Perfil</span>
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {profiles.map((profile) => (
            <DropdownMenuItem
              key={profile.id}
              className="flex items-center justify-between cursor-pointer"
              onClick={() => onSelectProfile(profile.id)}
            >
              <div className="flex items-center gap-2">
                <img
                  src={profile.profile.profilePicUrl}
                  alt={profile.profile.username}
                  className="w-6 h-6 rounded-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = `https://ui-avatars.com/api/?name=${profile.profile.username}`;
                  }}
                />
                <div>
                  <p className="font-medium text-sm">@{profile.profile.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {profile.profile.followers.toLocaleString()} seguidores
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {profile.id === activeProfileId && (
                  <Check className="w-4 h-4 text-primary" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Remover @${profile.profile.username} da sessão?`)) {
                      onRemoveProfile(profile.id);
                    }
                  }}
                  className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
                  title="Remover perfil"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              onAddProfile();
            }}
            className="cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Perfil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1.5 rounded-full hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground">
              <Info className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{profiles.length} perfil(is) • 6 criativos por perfil</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
