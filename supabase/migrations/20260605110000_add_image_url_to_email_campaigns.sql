-- キャンペーンメールに任意で画像を1枚添付できるようにする
-- image_url: Supabase Storage 等の公開 URL を直接貼り付ける運用
-- NULL の場合は画像なしメールを送信（後方互換あり）

alter table public.email_campaigns
  add column if not exists image_url text;

comment on column public.email_campaigns.image_url is
  'Optional: Full public URL of an image to embed in the campaign email body. Leave NULL for no image.';
