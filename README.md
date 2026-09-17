# acc-system-frontend

Vue 3 client for the accounting document collection system, using shadcn-vue, Pinia, Vue Router, Axios and Vue I18n.

F2 includes sign-in, session recovery, staff/client route boundaries, account/password settings, English/Chinese translations, and appearance preferences. F3 adds staff and customer management, contacts, bank accounts, accountant assignments, and invitation acceptance. Invitations generate a one-time link for manual sharing; email delivery is not yet connected.

## Local development

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm test
pnpm build
```

The browser calls `/api/v1` on the same origin. For integrated acceptance, use the backend repository's Docker Compose stack at `http://localhost`; `pnpm dev` alone does not start or proxy the API. Access tokens are kept in memory; the backend manages the HttpOnly refresh cookie.

Language, colour theme and light/dark/system mode live under **Account → Appearance & language** and are saved in this browser. New browsers use English, Evergreen and the system appearance.

## Build and run the image

```bash
pnpm build
docker build --build-arg APP_VERSION=local -t acc-system-frontend:local .
docker run --rm -p 8000:8000 acc-system-frontend:local
```

Open `http://localhost:8000` to check the standalone frontend image. Authentication requires the Nginx/API stack defined in the backend repository. HTML and assets revalidate on navigation so deployments do not leave SPA routes pointing at old bundles.

The GitHub Actions workflow needs one secret, `AWS_ROLE_ARN`, and two repository variables, `AWS_REGION` and `ECR_FRONTEND_REPOSITORY`.
Pull requests build and check the application without publishing. Pushes to `main`, version tags, and manual build-image runs also publish the commit SHA and `main` image tags to ECR. Lint and tests run in separate workflows; publishing does not wait for those workflows. No workflow deploys to the server automatically.
