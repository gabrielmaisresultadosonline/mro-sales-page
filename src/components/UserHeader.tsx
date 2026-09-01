import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LogOut, Clock, Crown, User, Lock, Unlock } from 'lucide-react';
import { getCurrentUser, logoutUser } from '@/lib/userStorage';
import { formatDaysRemaining, isLifetimeAccess, canUseCreatives } from '@/types/user';

interface UserHeaderProps {
  onLogout: () => void;
}

export const UserHeader = ({ onLogout }: UserHeaderProps) => {
  const user = getCurrentUser();

  if (!user) return null;

  const daysText = formatDaysRemaining(user.daysRemaining);
  const isLifetime = isLifetimeAccess(user.daysRemaining);
  const creativesAccess = canUseCreatives(user);

  const handleLogout = async () => {
    if (confirm('Deseja realmente sair?')) {
      await logoutUser();
      onLogout();
    }
  };

  return (
    <div className="flex items-center gap-3">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 text-sm">
              <User className="w-4 h-4" />
              <span className="font-medium">{user.username}</span>
              {isLifetime ? (
                <div className="flex items-center gap-1">
                  <Crown className="w-4 h-4 text-amber-500" />
                  {user.creativesUnlocked ? (
                    <Unlock className="w-3 h-3 text-green-500" />
                  ) : (
                    <Lock className="w-3 h-3 text-red-400" />
                  )}
                </div>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {user.daysRemaining}d
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-center space-y-1">
              <p className="font-semibold">{user.username}</p>
              <p className="text-xs text-muted-foreground">{daysText}</p>
              {isLifetime && (
                <p className={`text-xs ${creativesAccess.allowed ? 'text-green-400' : 'text-amber-400'}`}>
                  Criativos: {creativesAccess.allowed ? 'Liberado' : 'Bloqueado'}
                </p>
              )}
              {user.email && (
                <p className="text-xs text-muted-foreground mt-1">{user.email}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="w-4 h-4" />
      </Button>
    </div>
  );
};
