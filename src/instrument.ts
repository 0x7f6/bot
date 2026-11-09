import * as Sentry from "@sentry/node"
import env from "@/globals/env"

Sentry.init({
	dsn: env.SENTRY_URL,
	environment: process.env.NODE_ENV === 'development' ? 'development' : 'production',
	tracesSampleRate: 0.5
})
