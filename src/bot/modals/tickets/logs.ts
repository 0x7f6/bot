import Modal from "@/bot/modal"
import axios from "axios"
import { ActionRowBuilder, MessageFlags, TextInputBuilder, TextInputStyle } from "discord.js"
import { eq } from "drizzle-orm"
import diagnosisSelect from "@/bot/selects/tickets/diagnosis"
import { size } from "@rjweb/utils"

export default new Modal()
	.setName('tickets-logs')
	.setTitle('Submit Panel Logs')
	.build((builder) => builder
		.addRow((row) => row
			.addComponents([
				new TextInputBuilder()
					.setLabel('Log URL')
					.setCustomId('log_url')
					.setPlaceholder('https://pastes.dev/xxxxxx')
					.setStyle(TextInputStyle.Short)
					.setMinLength(29)
					.setMaxLength(29)
					.setRequired(true)
			])
		)
	)
	.listen(async(ctx, product: { id: number, name: string } | null, initialData: number[]) => {
		if (!ctx.interaction.guild || !ctx.interaction.isFromMessage()) return

		const url = ctx.interaction.fields.getTextInputValue('log_url')
		if (!url.startsWith('https://pastes.dev/') || url.length !== 29) {
			await ctx.interaction.update({})

			return ctx.interaction.followUp({
				content: '`📝` Invalid URL.',
				flags: [
					MessageFlags.Ephemeral
				]
			})
		}

		const log = await axios.get<string>(url.replace('pastes.dev', 'api.pastes.dev'), {
			maxContentLength: size(2.5).mb()
		}).catch(() => null)

		const mergedData = ctx.support.compactData({ ...ctx.support.expandData(initialData), addon: product?.id.toString() })
		const expandedMerged = ctx.support.expandData(mergedData)

		const firstDataPoint = await ctx.database.select()
			.from(ctx.database.schema.supportDataPoints)
			.where(eq(ctx.database.schema.supportDataPoints.priority, 0))
			.then((r) => r[0])

		const question = firstDataPoint.key in expandedMerged
			? ctx.support.nextQuestion(expandedMerged) ?? firstDataPoint
			: firstDataPoint

		await ctx.interaction.update({
			embeds: [
				ctx.Embed()
					.setTitle('`⚒️` Self-Diagnosis')
					.setDescription(ctx.join(
						'Before we open a ticket, we will ask you some questions in hopes of you finding the solution to your problem.',
						'',
						'> **Question**',
						`> ${question.question}`
					))
			], components: [
				new ActionRowBuilder()
					.addComponents(
						diagnosisSelect(ctx, [question.possibleValues], [mergedData, question.id, url.slice(-10)])
					) as any
			]
		})

		if (!log) return

		const errorResolution = await ctx.support.findSolutionToAutomaicError(log?.data)
		if (errorResolution) {
			return ctx.interaction.followUp({
				content: ctx.join(
					'> We have found a potential solution to your problem based on your logs. See if this helps, **if not**, continue with the self-diagnosis.',
					'',
					errorResolution
				), flags: [
					MessageFlags.Ephemeral
				]
			})
		}
	})
	.export()