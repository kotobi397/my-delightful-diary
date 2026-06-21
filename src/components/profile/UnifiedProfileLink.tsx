import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, type LinkProps } from 'react-router-dom';


import { supabase } from '@/integrations/supabase/client';
import { getPublicUserProfilePath } from '@/utils/userProfile';

type Props = Omit<LinkProps, 'to'> & {
  userId?: string | null;
  username?: string | null;
};

// Cache to avoid repeated lookups for the same user
const resolvedPathCache = new Map<string, string>();

function getUserFallbackPath(userId?: string | null, username?: string | null) {
  const identifier = (username || '').trim() || (userId || '').trim();
  return identifier ? getPublicUserProfilePath(identifier) : '/';
}

async function resolveAuthorPath(userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  const cacheKey = `uid:${userId}`;
  if (resolvedPathCache.has(cacheKey)) return resolvedPathCache.get(cacheKey)!;

  try {
    // المسار السريع: العمود author_slug على profiles يُحدّث تلقائياً عبر trigger
    const { data: profile } = await supabase
      .from('profiles')
      .select('author_slug')
      .eq('id', userId)
      .maybeSingle();

    const slug = (profile?.author_slug || '').trim();
    if (slug) {
      const path = `/author/${encodeURIComponent(slug)}`;
      resolvedPathCache.set(cacheKey, path);
      return path;
    }
  } catch (err) {
    console.warn('UnifiedProfileLink: author lookup failed', err);
  }
  return null;
}

export function UnifiedProfileLink({ userId, username, onClick, className, children, ...props }: Props) {
  const navigate = useNavigate();
  const fallbackTo = useMemo(() => getUserFallbackPath(userId, username), [userId, username]);
  const [resolvedTo, setResolvedTo] = useState<string>(fallbackTo);

  useEffect(() => {
    let cancelled = false;
    setResolvedTo(fallbackTo);
    if (!userId) return;
    resolveAuthorPath(userId).then((path) => {
      if (!cancelled && path) setResolvedTo(path);
    });
    return () => { cancelled = true; };
  }, [userId, fallbackTo]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e as any);
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      // استخدم تنقّل SPA بدلاً من إعادة تحميل الصفحة الكاملة لتجنّب اللاغ
      navigate(resolvedTo);
    },
    [onClick, resolvedTo, navigate]
  );


  return (
    <a
      href={resolvedTo}
      onClick={handleClick}
      className={className}
      {...props}
    >
      {children}
    </a>
  );
}
