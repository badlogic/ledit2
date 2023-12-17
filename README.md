# ledit2

A read-only client for Reddit, Hackernews, lobst.rs, and RSS feeds.

### Development

1. Install & run Docker
2. Install NodeJS +19

```
npm run dev
```

In VS Code run the `dev` launch config to connect to the Node server via the debugger, and spawn a Chrome instance for frontend debugging.

### Deployment

Deployment is tailored towards my setup, see `publish.sh`. If your setup is similar (VPS/root server + Docker + nginx-proxy + lets-encrypt-companion), then you can modify the `host` and `hostDir` fields in `package.json` to deploy to your own infrastructure.

1. Deploy backend & frontend: `./publish.sh server`
1. Deploy just the frontend: `./publish.sh`
