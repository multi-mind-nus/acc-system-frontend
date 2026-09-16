# acc-system-frontend

Vue 3 deployment baseline for the accounting document collection system.

## Local development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

## Build and run the image

```bash
pnpm build
docker build --build-arg APP_VERSION=local -t acc-system-frontend:local .
docker run --rm -p 8000:8000 acc-system-frontend:local
```

Open `http://localhost:8000`. Production traffic reaches this container through the Nginx service defined in the backend repository.

The GitHub Actions workflow needs one secret, `AWS_ROLE_ARN`, and two repository variables, `AWS_REGION` and `ECR_FRONTEND_REPOSITORY`.
