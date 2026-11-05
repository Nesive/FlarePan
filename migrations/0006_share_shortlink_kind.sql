-- Share short-link target kind (plain vs with-code), for the admin
-- shares management UI. Applied after 0005_upload_quotas.sql.
-- target_kind is NULL for rows recorded before this migration; the UI
-- shows those as "未知类型". No backfill: the mapping table does not
-- store targets, so the plain/code shape of a historical short link
-- cannot be recovered reliably from this table alone.
ALTER TABLE share_shortlinks ADD COLUMN target_kind TEXT;
