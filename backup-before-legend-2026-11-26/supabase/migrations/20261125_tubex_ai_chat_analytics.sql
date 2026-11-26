-- TubeX AI Chat usage is recorded in the existing product event stream.
-- No message content, prompts, or AI responses are stored in this telemetry.
create index if not exists tubex_events_ai_chat_created_idx
  on public.tubex_events(module, created_at desc)
  where module = 'ai_chat';
create index if not exists tubex_events_ai_chat_user_created_idx
  on public.tubex_events(user_id, created_at desc)
  where module = 'ai_chat';
