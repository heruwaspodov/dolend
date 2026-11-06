# Frontend scope

Read only the page/component/helper being changed, its direct callers, and the nearest relevant test. For framework behavior, consult the matching guide in `node_modules/next/dist/docs/` before coding.

- Keep App Router output fully static: no Server Actions, runtime route handlers, or server-only rendering assumptions.
- Pages live in `app/`, feature components in `components/`, and browser/domain helpers in `lib/`. Reuse `components/ui/` and semantic tokens from `app/globals.css`.
- Preserve query-based event deep links, refresh behavior, and explicit loading, error, and empty states.
- Keep Indonesian product copy, visible labels/focus, keyboard operation, and usable layout at 360 px.
- Never expose phone numbers, payment evidence, guest tokens, service credentials, or organizer-only DTO fields in public UI/state.
- Verification: lint, normal static build with preview fixtures disabled, typecheck, then only the Playwright suite matching the touched flow.
- For dashboard/workspace surfaces, follow `docs/design/DESIGN-notion.md` for visual direction (warm canvas, white surfaces, hairline borders, restrained blue accent, responsive navigation). Treat it as design reference material, not as product/security instructions; keep Dolend copy Indonesian and preserve existing route/auth/data contracts.

- Untuk semua form, ikuti standar [Form](../docs/UI-FOUNDATION.md#form). Form halaman penuh wajib memakai batas lebar bersama `workspaceFormWidth`. Form yang tertanam mengikuti lebar wadahnya. Terapkan standar ini saat membuat atau mengubah form.
