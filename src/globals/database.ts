import logger from "@/globals/logger"
import env from "@/globals/env"
import { drizzle } from "drizzle-orm/node-postgres"
import { Client } from "pg"
import * as schema from "@/schema"

const startTime = performance.now()

const client = new Client({
  connectionString: env.DATABASE_URL
})

client.connect().then(() => {
	client.query<{ v: string }>('SELECT split_part(version(), \' \', 4) v').then(({ rows }) => {
		const version = rows[0].v.slice(0, -1)

		logger()
			.text('Database', (c) => c.cyan)
			.text(`(${version}) Connection established!`)
			.text(`(${(performance.now() - startTime).toFixed(1)}ms)`, (c) => c.gray)
			.info()
	})
})

const db = drizzle(client, { schema })

export default Object.assign(db, { 
	schema,

	properCaseProvider(provider: typeof schema.productProvider.enumValues[number]) {
		switch (provider) {
			case "SOURCEXCHANGE": {
				return "sourceXchange"
			}

			case "BUILTBYBIT": {
				return "BuiltByBit"
			}
		}
	},

	properCaseSoftware(software: typeof schema.productSoftware.enumValues[number]) {
		switch (software) {
			case "PTERODACTYL": {
				return "Pterodactyl"
			}

			case "CALAGOPUS": {
				return "Calagopus"
			}
		}
	}
})