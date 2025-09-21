# TODO

- [ ] Implement admin APIs/UI for managing calculate activities (create/update/disable) incl. audit/error logs — backend services/routes refreshed and ActivityLibrary UI added; still need integration testing and content QA
- [ ] Update frontend calculate flow to consume new activity metadata and enforce disabled state — ActivitySelector now filters inactive/archived items; ensure downstream forms stay resilient when activities are retired mid-session
- [ ] Fix admin system logs page JS syntax issue and ensure related API contracts — new React code compiles locally but needs verification against backend search/export endpoints
- [ ] Investigate and resolve badge auto-grant (admin & user triggers) including rule validation UI — backend BadgeService was expanded; frontend rule editor still expects old schema and admin trigger flow untested
- [ ] Validate product image upload flow and migrate to Cloudflare R2; update backend/frontend + DB schema/migration — backend presign/endpoints ready; ProductManagement UI still text URL field and products table schema lacks migration guidance
- [ ] Refresh admin dialog styles to align with other create dialogs — create/edit modals in admin modules not yet refactored to match new pattern
- [ ] Sync OpenAPI spec, database scripts, and automated tests with changes — large diffs present; need targeted review to ensure contract/tests actually cover new flows
