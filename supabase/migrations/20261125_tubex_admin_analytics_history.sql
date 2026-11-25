-- Admin analytics: indexes supporting chronological aggregation and per-install history.
create index if not exists tubex_events_module_created_at_idx
  on public.tubex_events (module, created_at desc);
create index if not exists tubex_events_install_created_at_idx
  on public.tubex_events (install_id, created_at desc);
create index if not exists tubex_installations_first_seen_idx
  on public.tubex_installations (first_seen desc);
