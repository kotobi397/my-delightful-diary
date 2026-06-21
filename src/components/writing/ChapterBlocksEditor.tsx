import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Image as ImageIcon, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseChapterContent } from '@/lib/chapterContent';

export type EditorBlock =
  | { id: string; type: 'text'; value: string }
  | { id: string; type: 'image'; url: string };

const MAX_IMAGE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

export const contentToBlocks = (content: string): EditorBlock[] => {
  const parsed = parseChapterContent(content);
  if (parsed.length === 0) return [{ id: newId(), type: 'text', value: '' }];
  return parsed.map((b) =>
    b.type === 'image'
      ? ({ id: newId(), type: 'image', url: b.value } as EditorBlock)
      : ({ id: newId(), type: 'text', value: b.value.replace(/^\n+|\n+$/g, '') } as EditorBlock),
  );
};

export const blocksToContent = (blocks: EditorBlock[]): string =>
  blocks
    .map((b) => (b.type === 'image' ? `![](${b.url})` : b.value))
    .filter((s) => s.length > 0)
    .join('\n\n');

interface SortableBlockProps {
  block: EditorBlock;
  onChange: (value: string) => void;
  onRemove: () => void;
}

const SortableBlock: React.FC<SortableBlockProps> = ({ block, onChange, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex items-start gap-1 rounded-lg"
    >
      {/* Drag handle */}
      <button
        type="button"
        aria-label="اسحب لتغيير الترتيب"
        className="mt-2 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        {block.type === 'text' ? (
          <Textarea
            value={block.value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="اكتب هنا..."
            rows={Math.max(3, Math.min(20, block.value.split('\n').length + 1))}
            className="text-base leading-loose font-[Tajawal,sans-serif] resize-y"
            dir="rtl"
          />
        ) : (
          <figure className="relative">
            <img
              src={block.url}
              alt=""
              loading="lazy"
              className="rounded-lg w-full max-h-[420px] object-contain bg-muted border"
            />
          </figure>
        )}
      </div>

      {/* Remove */}
      {(block.type === 'image' || true) && (
        <button
          type="button"
          aria-label="حذف"
          onClick={onRemove}
          className="mt-1 flex-shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted opacity-60 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

interface Props {
  initialContent: string;
  userId: string;
  chapterId: string;
  onChange: (content: string) => void;
}

export const ChapterBlocksEditor: React.FC<Props> = ({
  initialContent,
  userId,
  chapterId,
  onChange,
}) => {
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => contentToBlocks(initialContent));
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initRef = useRef(false);

  // Re-sync if a different chapter loads.
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      return;
    }
    setBlocks(contentToBlocks(initialContent));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  const updateBlocks = useCallback(
    (next: EditorBlock[]) => {
      setBlocks(next);
      onChange(blocksToContent(next));
    },
    [onChange],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex((b) => b.id === active.id);
    const newIdx = blocks.findIndex((b) => b.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    updateBlocks(arrayMove(blocks, oldIdx, newIdx));
  };

  const updateBlockValue = (id: string, value: string) => {
    updateBlocks(
      blocks.map((b) => (b.id === id && b.type === 'text' ? { ...b, value } : b)),
    );
  };

  const removeBlock = (id: string) => {
    const next = blocks.filter((b) => b.id !== id);
    updateBlocks(next.length > 0 ? next : [{ id: newId(), type: 'text', value: '' }]);
  };

  const addTextBlock = () => {
    updateBlocks([...blocks, { id: newId(), type: 'text', value: '' }]);
  };

  const handleImageUpload = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('نوع الصورة غير مدعوم (JPG/PNG/WEBP/GIF)');
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`الحد الأقصى لحجم الصورة ${MAX_IMAGE_MB} ميجابايت`);
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${userId}/chapters/${chapterId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('stories')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('stories').getPublicUrl(path);
      const url = pub.publicUrl;
      updateBlocks([...blocks, { id: newId(), type: 'image', url }]);
      toast.success('تمت إضافة الصورة — اسحبها لتغيير مكانها');
    } catch (e) {
      console.error(e);
      toast.error('فشل رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-1"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
          <span>إضافة صورة</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTextBlock}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          <span>إضافة فقرة</span>
        </Button>
        <span className="text-[11px] text-muted-foreground">
          استخدم المقبض ⠿ لسحب الصورة/الفقرة وتغيير ترتيبها
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImageUpload(f);
            if (e.target) e.target.value = '';
          }}
        />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3" dir="rtl">
            {blocks.map((b) => (
              <SortableBlock
                key={b.id}
                block={b}
                onChange={(v) => updateBlockValue(b.id, v)}
                onRemove={() => removeBlock(b.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default ChapterBlocksEditor;
