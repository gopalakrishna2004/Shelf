import React, { useState, useEffect } from 'react';
import { User as UserIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length > 0) {
      return parts[0][0].toUpperCase();
    }
  }

  if (email && email.trim()) {
    return email.trim()[0].toUpperCase();
  }

  return '';
}

export function getAvatarUrlFromUser(user?: { user_metadata?: Record<string, any> } | null): string | null {
  if (!user || !user.user_metadata) return null;
  const meta = user.user_metadata;
  return meta.avatar_url || meta.picture || meta.avatar || null;
}

export function getUserDisplayName(user?: { user_metadata?: Record<string, any>; email?: string | null } | null): string {
  if (!user) return 'User';
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.user_name ||
    user.email ||
    'User'
  );
}

export function isGoogleAuthUser(user?: { app_metadata?: Record<string, any>; identities?: Array<{ provider: string }> } | null): boolean {
  if (!user) return false;
  if (user.app_metadata?.provider === 'google') return true;
  if (Array.isArray(user.app_metadata?.providers)) {
    if (user.app_metadata.providers.includes('google') && !user.app_metadata.providers.includes('email')) {
      return true;
    }
  }
  if (user.identities && user.identities.length > 0) {
    const hasGoogle = user.identities.some((id) => id.provider === 'google');
    const hasEmail = user.identities.some((id) => id.provider === 'email');
    if (hasGoogle && !hasEmail) return true;
  }
  return false;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  email,
  size = 'sm',
  className,
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const initials = getInitials(name, email);

  const sizeStyles = {
    sm: "w-8 h-8 text-xs rounded-[10px]",
    md: "w-10 h-10 text-sm rounded-[12px]",
    lg: "w-12 h-12 text-base font-semibold rounded-[15px]",
  }[size];

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  }[size];

  const containerClasses = cn(
    "relative shrink-0 bg-shelf-terracotta text-white flex items-center justify-center font-mono select-none overflow-hidden transition-all duration-150 shadow-[0_2px_8px_rgba(201,75,54,0.22)]",
    sizeStyles,
    className
  );

  if (src && !hasError) {
    return (
      <div className={containerClasses}>
        <img
          src={src}
          alt={name || email || 'User Avatar'}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={containerClasses} aria-label={name || email || 'User Avatar'}>
      {initials ? (
        <span className="leading-none tracking-tight font-sans font-semibold">{initials}</span>
      ) : (
        <UserIcon className={iconSizes} />
      )}
    </div>
  );
};
