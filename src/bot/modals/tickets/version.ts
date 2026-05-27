import Modal from "@/bot/modal"
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from "discord.js"
import diagnosisButton from "@/bot/buttons/tickets/diagnosis"
import { eq } from "drizzle-orm"

export default new Modal()
	.setName('tickets-version')
	.setTitle('Submit Panel Logs')
	.build((builder) => builder
		.addRow((row) => row
			.addComponents([
				new TextInputBuilder()
					.setLabel('Version of the Product (from the Admin Panel)')
					.setCustomId('version')
					.setPlaceholder('1.0.0')
					.setStyle(TextInputStyle.Short)
					.setMinLength(5)
					.setMaxLength(8)
					.setRequired(true)
			])
		)
	)
	.listen(async(ctx, product: { id: number, name: string }, initialData: number[]) => {
		if (!ctx.interaction.guild || !ctx.interaction.isFromMessage()) return

		const version = ctx.interaction.fields.getTextInputValue('version').trim()
		if (version.split('.').length !== 3) {
			await ctx.interaction.update({})

			return ctx.interaction.followUp({
				content: '`📝` Invalid version.',
				flags: [
					MessageFlags.Ephemeral
				]
			})
		}

		const latest = await ctx.database.select({
			version: ctx.database.schema.products.version,
			software: ctx.database.schema.products.software,
			productProvider: ctx.database.schema.productProviders.provider,
			productProviderLink: ctx.database.schema.productProviders.link
		})
			.from(ctx.database.schema.products)
			.innerJoin(ctx.database.schema.productProviders, eq(ctx.database.schema.products.id, ctx.database.schema.productProviders.productId))
			.where(eq(ctx.database.schema.products.id, product.id))

		const logCommand = (() => {
			switch (latest[0].software) {
				case 'PTERODACTYL': return ctx.join(
					'Please run the following command in the pterodactyl directory:',
					'-# usually `/var/www/pterodactyl`',
					'```bash',
					'tail -n 500 storage/logs/$(ls -t storage/logs/laravel-*.log | head -n1 | xargs basename) | curl -T - https://api.pastes.dev/post',
					'```'
				)

				case 'CALAGOPUS': return ctx.join(
					'Please run the following command in the directory where calagopus is installed:',
					'```bash',
					'docker compose logs --tail=500 --no-color --timestamps | curl -T - https://api.pastes.dev/post',
					'```',
					'',
					'If you are not using docker, please run the following command instead:',
					'```bash',
					'calagopus-panel diagnostics --log-lines 500',
					'```'
				)
			}
		})()

		await ctx.interaction.update({
			embeds: [
				ctx.Embed()
					.setTitle('`⚒️` Open Ticket')
					.setDescription(ctx.join(
						'> Before we open a ticket, we will ask you some questions in hopes of you finding the solution to your problem.',
						'',
						logCommand
					))
			], components: [
				new ActionRowBuilder()
					.addComponents(
						new StringSelectMenuBuilder()
							.setCustomId('ticket-product-fake')
							.setPlaceholder(product.name || 'None')
							.addOptions({ label: 'None', value: 'none' })
							.setMaxValues(1)
							.setMinValues(1)
							.setDisabled(true)
					) as any,
				new ActionRowBuilder()
					.addComponents(
						new ButtonBuilder()
							.setLabel('Self-Diagnosis')
							.setStyle(ButtonStyle.Primary)
							.setEmoji('1150889684227076227')
							.setCustomId(diagnosisButton(ctx.interaction, product.id, initialData))
					) as any
			]
		})

		if (latest[0].version !== version) {
			return ctx.interaction.followUp({
				content: ctx.join(
					'> Please try updating to the latest version of the product before continuing the self-diagnosis.',
					'',
					`The latest version is \`${latest[0].version}\`.`,
					latest.map((p) => `[\`${ctx.database.properCaseProvider(p.productProvider)}\`](<${p.productProviderLink}>)`).join(' | ')
				), flags: [
					MessageFlags.Ephemeral
				]
			})
		}
	})
	.export()