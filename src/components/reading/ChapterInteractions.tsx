import React, { useEffect, useState, useCallback } from 'react';
import { Heart, MessageCircle, Loader2, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/components/ui/sonner';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface CommentRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { username: string | null; avatar_url: string | null } | null;
}

interface Props {
  chapterId: string;
}

export const ChapterInteractions: React.FC<Props> = ({ chapterId }) => {
  const { user } = useAuth();
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);

  // Initial counts + own like state
  useEffect(() => {
    if (!chapterId) return;
    (async () => {
      const [{ count: lc }, { count: cc }] = await Promise.all([
        supabase
          .from('chapter_likes')
          .select('id', { count: 'exact', head: true })
          .eq('chapter_id', chapterId),
        supabase
          .from('chapter_comments')
          .select('id', { count: 'exact', head: true })
          .eq('chapter_id', chapterId),
      ]);
      setLikeCount(lc || 0);
      setCommentCount(cc || 0);

      if (user) {
        const { data } = await supabase
          .from('chapter_likes')
          .select('id')
          .eq('chapter_id', chapterId)
          .eq('user_id', user.id)
          .maybeSingle();
        setLiked(!!data);
      } else {
        setLiked(false);
      }
    })();
  }, [chapterId, user]);

  const toggleLike = useCallback(async () => {
    if (!user) {
      toast.error('يجب تسجيل الدخول لإضافة إعجاب');
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);
    // optimistic
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      if (next) {
        const { error } = await supabase
          .from('chapter_likes')
          .insert({ chapter_id: chapterId, user_id: user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('chapter_likes')
          .delete()
          .eq('chapter_id', chapterId)
          .eq('user_id', user.id);
        if (error) throw error;
      }
    } catch (e: any) {
      // revert
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
      toast.error('تعذر تحديث الإعجاب');
    } finally {
      setLikeBusy(false);
    }
  }, [user, liked, likeBusy, chapterId]);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    const { data: rows } = await supabase
      .from('chapter_comments')
      .select('id,user_id,content,created_at')
      .eq('chapter_id', chapterId)
      .order('created_at', { ascending: false })
      .limit(200);

    const list = (rows || []) as CommentRow[];
    const userIds = Array.from(new Set(list.map((r) => r.user_id)));
    if (userIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id,username,avatar_url')
        .in('id', userIds);
      const map = new Map((profs || []).map((p: any) => [p.id, p]));
      list.forEach((r) => {
        const p = map.get(r.user_id);
        r.profile = p ? { username: p.username, avatar_url: p.avatar_url } : null;
      });
    }
    setComments(list);
    setCommentCount(list.length);
    setLoadingComments(false);
  }, [chapterId]);

  useEffect(() => {
    if (commentsOpen) loadComments();
  }, [commentsOpen, loadComments]);

  const submitComment = async () => {
    if (!user) {
      toast.error('يجب تسجيل الدخول لإضافة تعليق');
      return;
    }
    const content = newComment.trim();
    if (!content) return;
    if (content.length > 2000) {
      toast.error('التعليق طويل جدًا');
      return;
    }
    setPosting(true);
    const { data, error } = await supabase
      .from('chapter_comments')
      .insert({ chapter_id: chapterId, user_id: user.id, content })
      .select('id,user_id,content,created_at')
      .single();
    setPosting(false);
    if (error) {
      toast.error('تعذر إرسال التعليق');
      return;
    }
    // fetch own profile for display
    const { data: prof } = await supabase
      .from('profiles')
      .select('username,avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    const row: CommentRow = {
      ...(data as any),
      profile: prof ? { username: prof.username, avatar_url: prof.avatar_url } : null,
    };
    setComments((prev) => [row, ...prev]);
    setCommentCount((c) => c + 1);
    setNewComment('');
  };

  const deleteComment = async (id: string) => {
    if (!user) return;
    const prev = comments;
    setComments((p) => p.filter((c) => c.id !== id));
    setCommentCount((c) => Math.max(0, c - 1));
    const { error } = await supabase
      .from('chapter_comments')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) {
      setComments(prev);
      setCommentCount((c) => c + 1);
      toast.error('تعذر حذف التعليق');
    }
  };

  const timeAgo = (iso: string) => {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ar });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex items-center gap-2 my-6" dir="rtl">
      <Button
        type="button"
        variant={liked ? 'default' : 'outline'}
        onClick={toggleLike}
        disabled={likeBusy}
        className="gap-1"
        aria-pressed={liked}
        aria-label="إعجاب"
      >
        <Heart
          className={`h-4 w-4 ${liked ? 'fill-current' : ''}`}
        />
        <span>{likeCount}</span>
      </Button>

      <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" className="gap-1" aria-label="التعليقات">
            <MessageCircle className="h-4 w-4" />
            <span>{commentCount}</span>
            <span className="hidden sm:inline mr-1">التعليقات</span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="flex flex-col p-0 h-[85vh] max-h-[85vh] z-[100] pb-[var(--bottom-nav-safe-space,0px)]"
          dir="rtl"
        >
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle>التعليقات ({commentCount})</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {loadingComments ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">
                لا توجد تعليقات بعد. كن أول من يعلّق!
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2 items-start">
                  {c.profile?.avatar_url ? (
                    <img
                      src={c.profile.avatar_url}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {(c.profile?.username || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <Link
                        to={`/user/${c.user_id}`}
                        className="font-semibold text-foreground hover:text-primary truncate"
                      >
                        {c.profile?.username || 'مستخدم'}
                      </Link>
                      <span className="text-muted-foreground">{timeAgo(c.created_at)}</span>
                      {user?.id === c.user_id && (
                        <button
                          type="button"
                          onClick={() => deleteComment(c.id)}
                          className="text-muted-foreground hover:text-destructive mr-auto"
                          aria-label="حذف"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words mt-0.5">
                      {c.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t p-3 bg-background">
            {user ? (
              <div className="flex gap-2 items-end">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="اكتب تعليقك..."
                  rows={2}
                  maxLength={2000}
                  className="resize-none flex-1"
                />
                <Button
                  type="button"
                  onClick={submitComment}
                  disabled={posting || !newComment.trim()}
                  size="icon"
                  aria-label="إرسال"
                >
                  {posting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground">
                <Link to="/auth" className="text-primary font-semibold">
                  سجّل الدخول
                </Link>{' '}
                للمشاركة في التعليقات
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ChapterInteractions;
