-- Hide all existing cosmetic shop items
UPDATE public.shop_items SET is_active = false WHERE category <> 'ai_feature';

-- Insert new AI feature items
INSERT INTO public.shop_items (code, category, title_ar, description_ar, price_coins, preview_value, sort_order, is_active)
VALUES
  ('ai_book_summary',    'ai_feature', 'تلخيص الكتاب',          'احصل على ملخص شامل للكتاب بأكمله',                    30, '📖', 1, true),
  ('ai_chapter_summary', 'ai_feature', 'تلخيص فصل',             'لخّص فصلاً معيناً من الكتاب',                          15, '📑', 2, true),
  ('ai_extract_quotes',  'ai_feature', 'استخراج أهم الاقتباسات', 'استخرج أبرز الاقتباسات من الكتاب',                    20, '💬', 3, true),
  ('ai_similar_books',   'ai_feature', 'اقتراح كتب مشابهة',     'احصل على قائمة بكتب مشابهة قد تعجبك',                 10, '🔍', 4, true),
  ('ai_ask_question',    'ai_feature', 'سؤال عن الكتاب',        'اطرح سؤالاً عن الكتاب واحصل على إجابة دقيقة',          5, '❓', 5, true)
ON CONFLICT (code) DO UPDATE SET
  category = EXCLUDED.category,
  title_ar = EXCLUDED.title_ar,
  description_ar = EXCLUDED.description_ar,
  price_coins = EXCLUDED.price_coins,
  preview_value = EXCLUDED.preview_value,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

-- Coin spending RPC for pay-per-use AI features
CREATE OR REPLACE FUNCTION public.gam_spend_coins(_amount integer, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _bal integer;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_amount');
  END IF;

  SELECT coins INTO _bal FROM public.user_gamification WHERE user_id = _uid FOR UPDATE;
  IF _bal IS NULL THEN
    INSERT INTO public.user_gamification (user_id, coins, xp) VALUES (_uid, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    _bal := 0;
  END IF;

  IF _bal < _amount THEN
    RETURN jsonb_build_object('success', false, 'reason', 'insufficient_coins', 'balance', _bal, 'required', _amount);
  END IF;

  UPDATE public.user_gamification
  SET coins = coins - _amount
  WHERE user_id = _uid;

  RETURN jsonb_build_object('success', true, 'spent', _amount, 'reason', _reason, 'new_balance', _bal - _amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gam_spend_coins(integer, text) TO authenticated;