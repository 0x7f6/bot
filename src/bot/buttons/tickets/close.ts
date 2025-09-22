import Button from "@/bot/button"
import { MessageFlags } from "discord.js"
import { eq } from "drizzle-orm"
import { createTranscript, ExportReturnType } from "discord-html-transcripts"
import axios from "axios"
import { size, string } from "@rjweb/utils"

export default new Button()
	.setName('ticket-close')
	.listen(async (ctx) => {
		const ticket = await ctx.database.select({
			id: ctx.database.schema.tickets.id,
			discordId: ctx.database.schema.tickets.discordId
		})
			.from(ctx.database.schema.tickets)
			.where(eq(ctx.database.schema.tickets.channelId, ctx.interaction.channelId))
			.then((r) => r[0])

		if (!ticket) return

		if (ctx.support.closingTickets.has(ticket.id)) return ctx.interaction.reply({
			content: '`⚒️` Ticket is already being closed.',
			flags: [
				MessageFlags.Ephemeral
			]
		})

		ctx.support.closingTickets.add(ticket.id)

		await ctx.interaction.deferReply({ flags: [MessageFlags.Ephemeral] })

		const s3Key = `tickets/${ticket.id}-${string.generate()}`

		const transcript = await createTranscript(ctx.interaction.channel!, {
			returnType: ExportReturnType.Buffer,
			poweredBy: false,
			hydrate: true,
			footerText: ' ',
			callbacks: {
				async resolveImageSrc(attachment) {
					const { data } = await axios.get<Buffer>(attachment.url, {
						responseType: 'arraybuffer',
						maxContentLength: size(10).mb()
					})

					return ctx.s3.url(`${s3Key}/${string.generate()}-${attachment.filename}`, data, attachment.content_type ?? undefined)
				}
			}
		})

		const transcriptUrl = await ctx.s3.url(`${s3Key}/index.html`, transcript, 'text/html')

		await Promise.allSettled([
			ctx.database.update(ctx.database.schema.tickets)
				.set({ transcript: transcriptUrl, closed: new Date() })
				.where(eq(ctx.database.schema.tickets.id, ticket.id)),
			ctx.interaction.channel?.delete(),
			ctx.client.users.send(ticket.discordId, {
				content: ctx.join(
					'`⚒️` Your ticket has been closed.',
					'',
					'> **Transcript**',
					`> [\`View Transcript\`](${transcriptUrl})`
				)
			})
		])

		const logChannel = await ctx.client.channels.fetch(ctx.env.TICKET_LOG_CHANNEL)
		if (logChannel?.isSendable()) {
			await logChannel.send({
				embeds: [
					ctx.Embed()
						.setTitle('`⚒️` Ticket Closed')
						.setThumbnail(ctx.interaction.user.displayAvatarURL())
						.setFields([
							{
								name: 'User',
								value: `<@${ticket.discordId}>`,
								inline: true
							},
							{
								name: 'Transcript',
								value: `[\`View Transcript\`](${transcriptUrl})`,
								inline: true
							},
							{
								name: 'Closer',
								value: `<@${ctx.interaction.user.id}>`,
								inline: true
							}
						])
				]
			})
		}

		ctx.support.closingTickets.delete(ticket.id)
	})
	.export()