# BLE MVP test report

## Verified

The following checks were completed before opening the BLE MVP pull request:

- TypeScript compiled with `npx tsc --noEmit`.
- Expo Doctor passed all 18 checks.
- `go test ./...` and `go vet ./...` passed. The backend does not yet have automated Go test files.
- A signed Xcode Debug build compiled and launched in the iOS Simulator.
- Signed physical-device builds installed on an iPhone 14 Pro and an iPhone 13 Pro Max.
- Both physical iPhones loaded the development bundle from Metro over the LAN.
- Bluetooth discovery, peer identity exchange, RSSI updates, proximity gating, and the Bump action
  worked between the two physical iPhones.
- Two different users were paired successfully through the backend.
- API smoke testing covered registration, login, photo upload, feed retrieval, BLE-method bump
  creation, and serving the uploaded image.
- A valid photo upload returned HTTP `200`; an upload larger than 10 MB returned HTTP `400`.

## Current MVP limitations

- RSSI is a noisy proximity estimate, not a precise distance measurement.
- The BLE identity/session value is suitable for local MVP testing, but it is not yet a production
  trust boundary. A client could forge another user ID.
- A production bump should use server-issued, short-lived challenges and confirmation from both
  authenticated users.
- UWB/Nearby Interaction is not implemented yet.
- Real BLE behavior cannot be validated in the iOS Simulator.
- The Go API and Metro must be reachable from both phones on the local network during development.

## Image-storage roadmap

Uploads currently live in `backend/uploads` and the SQLite database stores a relative local URL.
That works for a single local backend, but files will not automatically follow a deployment,
multiple backend instances, or a new development machine.

The next backend media phase should:

1. Choose durable object storage, such as S3-compatible storage, Supabase Storage, or Vercel Blob.
2. Keep storage credentials only on the backend and in managed environment variables.
3. Generate collision-resistant object keys and validate MIME type and size server-side.
4. Store the durable object key/URL in the post record instead of a local filesystem path.
5. Decide between backend-proxied uploads and short-lived signed direct uploads.
6. Add thumbnail/image-size processing so the mobile feed does not download full originals.
7. Define deletion, orphan cleanup, retention, backup, and migration behavior.
8. Migrate existing `backend/uploads` files before removing local-file serving.
9. Add automated tests for upload validation, failed storage writes, and URL persistence.

Until that phase is complete, local uploads should be treated as development data rather than
durable synchronized media.
