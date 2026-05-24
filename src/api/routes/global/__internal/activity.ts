import { globalAPIRouter } from "@/api"
import { client } from "@/bot"
import { string } from "@rjweb/utils"
import { EmbedBuilder } from "discord.js"
import { and, eq } from "drizzle-orm"

export = new globalAPIRouter.Path('/')
	.http('POST', '/', (http) => http
		.onRequest(async(ctr) => {
			if (ctr.headers.get('authorization', '') !== ctr["@"].env.PTERO_ADMIN_TOKEN) return ctr.status(ctr.$status.UNAUTHORIZED).print({ success: false, error: 'Unauthorized' })

			const [ data, error ] = await ctr.bindBody((z) => z.object({
				id: z.string(),
				event: z.string(),
				properties: z.record(z.string(), z.any()).transform((v) => Object.fromEntries(Object.entries(v).filter(([ k ]) => k !== '_token'))),
				timestamp: z.string().transform((v) => new Date(v)),
				actor: z.string().email(),
				server: z.object({
					name: z.string(),
					uuid: z.string().uuid()
				}).nullable()
			}))

			if (error) return ctr.status(ctr.$status.BAD_REQUEST).print({ success: false, error: error.message })

			let discordId = data.actor.slice(5)
			discordId = discordId.slice(0, discordId.indexOf('@'))

			if (!discordId) return ctr.print({})

			const demoAccess = await ctr["@"].database.select({
				id: ctr["@"].database.schema.demoAccesses.id,
			}).from(ctr["@"].database.schema.demoAccesses)
				.where(and(
					eq(ctr["@"].database.schema.demoAccesses.discordId, discordId),
					eq(ctr["@"].database.schema.demoAccesses.expired, false)
				))
				.then((r) => r[0])

			const ip = ctr["@"].proxmox.getIP(demoAccess.id || -8)

			setImmediate(async() =>
				await client.guilds.cache.get(ctr["@"].env.DISCORD_SERVER)!.channels.fetch(ctr["@"].env.DEMO_CHANNEL)
					.then(async(channel) => 'send' in channel! ? channel.send({
						embeds: [
							new EmbedBuilder()
								.setTitle('`🔍` Pterodactyl Activity')
								.setThumbnail(await client.users.fetch(discordId).then((u) => u.displayAvatarURL()).catch(() => null))
								.setFields([
									{
										name: `\`🔍\` Event`,
										value: `\`${data.event}\``,
										inline: true
									},
									{
										name: `\`👤\` User`,
										value: `<@${discordId}>`,
										inline: true
									},
									{
										name: `\`🔗\` Server`,
										value: data.server ? `[\`${data.server.name}\`](<${ctr["@"].pterodactyl.url(ctr["@"].env.PTERO_URL, ip)}/server/${data.server.uuid.slice(0, 8)})` : '`none`',
										inline: true
									},
									...Object.keys(data.properties).length ? [{
										name: '`📄` Properties',
										value: ctr["@"].join(
											'```json',
											string.limit(JSON.stringify(data.properties, null, 2), 1000),
											'```'
										)
									}] : []
								])
								.setTimestamp(new Date(data.timestamp))
						]
					}) : null)
			)

			return ctr.print({})
		})
	)