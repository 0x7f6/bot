import Select from "@/bot/select"
import { ActionRowBuilder } from "discord.js"
import { eq } from "drizzle-orm"
import ticketsVersionModal from "@/bot/modals/tickets/version"
import diagnosisSelect from "@/bot/selects/tickets/diagnosis"

export default new Select()
	.setName('ticket-product')
	.setPlaceholder('Select what Product this is related to')
	.build((builder, products: { name: string, identifier: string }[]) => {
		for (const product of products) {
			builder.addOption((option) => option
				.setLabel(product.name)
				.setValue(product.identifier)
			)
		}

		builder.addOption((option) => option
			.setLabel('None')
			.setValue('none')
		)

		return builder
	})
	.listen(async(ctx, initialData: number[]) => {
		const product = ctx.interaction.values[0] === 'none' ? null : await ctx.database.select({
			id: ctx.database.schema.products.id,
			name: ctx.database.schema.products.name
		})
			.from(ctx.database.schema.products)
			.where(eq(ctx.database.schema.products.identifier, ctx.interaction.values[0]))
			.limit(1)
			.then((r) => r[0])

		if (product) {
			return ctx.interaction.showModal(await ticketsVersionModal(ctx.interaction, [], [product, initialData]))
		}

		const expandedInitial = ctx.support.expandData(initialData)

		const firstDataPoint = await ctx.database.select()
			.from(ctx.database.schema.supportDataPoints)
			.where(eq(ctx.database.schema.supportDataPoints.priority, 0))
			.then((r) => r[0])

		const question = firstDataPoint.key in expandedInitial
			? ctx.support.nextQuestion(expandedInitial) ?? firstDataPoint
			: firstDataPoint

		return ctx.interaction.update({
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
						diagnosisSelect(ctx, [question.possibleValues], [initialData, question.id, ''])
					) as any
			]
		})
	})
	.export()