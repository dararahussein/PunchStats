# PunchStats

A TypeScript-based fight statistics and analytics platform, built with Next.js and PostgreSQL.

## Getting Started

To get up and running locally:

```bash
pnpm install && pnpm setup && pnpm dev
```

Then visit [http://localhost:3000/fighters](http://localhost:3000/fighters) to see the fighter directory.

The `setup` script:
1. Starts a local PostgreSQL container via Docker Compose
2. Runs database migrations
3. Seeds the database with fictional test data

Once the app is running, you can also:
- Visit [http://localhost:3000](http://localhost:3000) for the home page with navigation
- Run `pnpm test` to execute the integration test suite against the test database
- Run `pnpm build` and `pnpm start` for production builds

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
