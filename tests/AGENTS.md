# Browser test scope

Open only the spec for the touched user flow plus the production code it exercises.

- Tests run against static export in `out/`; build first.
- Assert observable behavior, authorization/privacy boundaries, refresh/deep links, and loading/error/empty states. Do not duplicate implementation details.
- Keep fixtures synthetic and free of PII, credentials, access tokens, and real payment evidence.
- Use the narrowest script (`test:landing`, `test:demo`, `test:account`, `test:organizer`, or `test:participation`) before broader hosting checks.
- A local fixture pass is not evidence of hosted integration, deployment, or release readiness.
