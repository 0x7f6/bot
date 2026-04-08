import { client } from "@/bot"
import Crontab from "@/crontab"
import env from "@/globals/env"
import logger from "@/globals/logger"
import { time } from "@rjweb/utils"
import { and, eq, sql } from "drizzle-orm"

export default new Crontab()
	.cron('* * * * *')
	.listen(async(ctx) => {
		const expiredDemoAccesses = await ctx.database.select({
			id: ctx.database.schema.demoAccesses.id,
			discordId: ctx.database.schema.demoAccesses.discordId
		}).from(ctx.database.schema.demoAccesses)
			.where(and(
				eq(ctx.database.schema.demoAccesses.expired, false),
				sql`${ctx.database.schema.demoAccesses.created} < current_timestamp - INTERVAL '1 hour'`
			))

		if (!expiredDemoAccesses.length) return

		logger()
			.text('Removing')
			.text(expiredDemoAccesses.length, (c) => c.cyan)
			.text('Demo Accesses')
			.info()

		for (const expiredDemoAccess of expiredDemoAccesses) {
			const member = await client.guilds.fetch(env.DISCORD_SERVER)
				.then((guild) => guild
					.members.fetch(expiredDemoAccess.discordId)
				)

			const ip = ctx.proxmox.getIP(expiredDemoAccess.id)
			const lxcId = 10000 + ip.rawData[3]

			const proxmoxClient = ctx.proxmox.getClient()

			await proxmoxClient.nodes.$(env.PROXMOX_NODE).lxc.$(lxcId).status.stop.$post()

			while (await proxmoxClient.nodes.$(ctx.env.PROXMOX_NODE).lxc.$(lxcId).status.current.$get().then((e) => e.status !== 'stopped')) {
				await time.wait(time(1).s())
			}

			await Promise.allSettled([
				ctx.database.update(ctx.database.schema.demoAccesses)
					.set({ expired: true })
					.where(eq(ctx.database.schema.demoAccesses.discordId, expiredDemoAccess.discordId)),
				proxmoxClient.nodes.$(env.PROXMOX_NODE).lxc.$(lxcId).$delete()
			])

			await Promise.allSettled([
				member.roles.remove(env.DEMO_ROLE),
				member.send('`🔍` Your **1 hour** demo acccess has expired.'),
				client.guilds.cache.get(env.DISCORD_SERVER)!.channels.fetch(env.DEMO_CHANNEL)
					.then((channel) => 'send' in channel!
						? channel.send({ content: `\`🔍\` <@${member.id}>'s demo acccess has expired.`, allowedMentions: { users: [] } })
						: null
					)
			])
		}
	})