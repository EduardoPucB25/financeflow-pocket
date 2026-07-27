INSERT INTO public.subscriptions (user_id, paddle_subscription_id, paddle_customer_id, product_id, price_id, status, current_period_start, current_period_end, cancel_at_period_end, environment)
VALUES
 ('734f7d52-51d7-4336-bfed-94dae7e73b91','manual_comp_sandbox_734f7d52','manual_comp_customer','pro_plan','pro_annual','active', now(), now() + interval '10 years', false,'sandbox'),
 ('734f7d52-51d7-4336-bfed-94dae7e73b91','manual_comp_live_734f7d52','manual_comp_customer','pro_plan','pro_annual','active', now(), now() + interval '10 years', false,'live')
ON CONFLICT (paddle_subscription_id) DO UPDATE
  SET status='active', current_period_end = now() + interval '10 years', updated_at = now();

UPDATE public.profiles
SET plan='pro', pro_expires_at = now() + interval '10 years', updated_at = now()
WHERE id = '734f7d52-51d7-4336-bfed-94dae7e73b91';