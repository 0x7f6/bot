import Command from "@/bot/command"
import { and, count, eq, ilike, inArray } from "drizzle-orm"
import productsButton from "@/bot/buttons/products"
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, MessageFlags } from "discord.js"
import linkSourcexchangeButton from "@/bot/buttons/link/sourcexchange"

export default new Command()
	.build((builder) => builder
		.setName('product')
		.setContexts(InteractionContextType.Guild)
		.setDescription('Product commands')
		.addSubcommandGroup((command) => command
			.setName('list')
			.setDescription('List products')
			.addSubcommand((command) => command
				.setName('all')
				.setDescription('List all products')
				.addStringOption((option) => option
					.setName('software')
					.setDescription('Filter by software')
					.addChoices(
						{ name: 'Pterodactyl', value: 'PTERODACTYL' },
						{ name: 'Calagopus', value: 'CALAGOPUS' }
					)
					.setRequired(false)
				)
			)
			.addSubcommand((command) => command
				.setName('linked')
				.setDescription('List your linked products')
				.addUserOption((option) => option
					.setName('user')
					.setDescription('The user to list linked products of')
					.setRequired(false)
				)
				.addStringOption((option) => option
					.setName('software')
					.setDescription('Filter by software')
					.addChoices(
						{ name: 'Pterodactyl', value: 'PTERODACTYL' },
						{ name: 'Calagopus', value: 'CALAGOPUS' }
					)
					.setRequired(false)
				)
			)
		)
		.addSubcommandGroup((command) => command
			.setName('link')
			.setDescription('Link a product')
			.addSubcommand((command) => command
				.setName('sourcexchange')
				.setDescription('Link a SourceXchange purchase')
			)
			.addSubcommand((command) => command
				.setName('builtbybit')
				.setDescription('Link all BuiltByBit purchases')
			)
		)
		.addSubcommand((command) => command
			.setName('unlink')
			.setDescription('Unlink a product')
			.addIntegerOption((option) => option
				.setName('product')
				.setDescription('The product to unlink')
				.setAutocomplete(true)
				.setRequired(true)
			)
		)
	)
	.listen(async(ctx) => {
		if (!ctx.interaction.guild) return

		switch (ctx.interaction.options.getSubcommandGroup()) {
			case "link": {
				switch (ctx.interaction.options.getSubcommand()) {
					case "sourcexchange": {
						return ctx.interaction.reply({
							embeds: [
								ctx.Embed()
									.setTitle('`🔗` Link Purchase')
									.setDescription(ctx.join(
										'To link one of your purchases, please visit your [accesses](https://www.sourcexchange.net/accesses),',
										'and copy the transaction id of the addon you want to link as shown below.'
									))
									.setImage('https://cdn.rjns.dev/addons/sourcexchange_linking_instructions.jpg')
							], components: [
								new ActionRowBuilder()
									.setComponents(
										new ButtonBuilder()
											.setLabel('Link Purchase')
											.setEmoji('1150889514236137605')
											.setStyle(ButtonStyle.Primary)
											.setCustomId(linkSourcexchangeButton(ctx.interaction))
									) as any
							], flags: [
								MessageFlags.Ephemeral
							]
						})
					}

					case "builtbybit": {
						await ctx.interaction.deferReply({ flags: [MessageFlags.Ephemeral] })

						try {
							const user = await ctx.builtbybit.user(ctx.interaction.user.id)

							const products = await ctx.database.select({
								id: ctx.database.schema.products.id,
								paymentId: ctx.database.schema.productLinks.paymentId,
								name: ctx.database.schema.products.name,
								role: ctx.database.schema.products.role,
								productProviderId: ctx.database.schema.productProviders.id,
								productProviderProductId: ctx.database.schema.productProviders.productProviderId
							}).from(ctx.database.schema.products)
								.leftJoin(ctx.database.schema.productProviders, eq(ctx.database.schema.products.id, ctx.database.schema.productProviders.productId))
								.leftJoin(ctx.database.schema.productLinks, and(
									eq(ctx.database.schema.productProviders.id, ctx.database.schema.productLinks.providerId),
									eq(ctx.database.schema.products.id, ctx.database.schema.productLinks.productId),
									eq(ctx.database.schema.productLinks.discordId, ctx.interaction.user.id)
								))
								.where(eq(ctx.database.schema.productProviders.provider, 'BUILTBYBIT'))

							let count = 0
							for (let i = 0; i < products.length; i++) {
								const access = await ctx.builtbybit.access(products[i].productProviderProductId!, user)

								if (!access || products[i].paymentId) continue

								await Promise.all([
									ctx.database.insert(ctx.database.schema.productLinks)
										.values({
											discordId: ctx.interaction.user.id,
											paymentId: access.license_id.toString(),
											productId: products[i].id,
											providerId: products[i].productProviderId!,
											created: new Date(access.start_date * 1000)
										}),
									ctx.interaction.guild.members.fetch(ctx.interaction.user.id)
										.then((member) => member.roles.add(products[i].role))
										.then((member) => member.roles.add(ctx.env.CUSTOMER_ROLE))
										.catch(() => {})
								])

								count++
							}

							if (count < 1) return ctx.interaction.editReply('`🔗` No purchases found.')
							return ctx.interaction.editReply(`\`🔗\` ${count} purchase${count === 1 ? '' : 's'} linked successfully.`)
						} catch {
							return ctx.interaction.editReply(ctx.join(
								'`🔗` No purchases found. Make sure to link your builtbybit account with your discord account.',
								'> <https://builtbybit.com/account/discord>'
							))
						}
					}
				}
			}

			case "list": {
				const softwareFilter = ctx.interaction.options.getString('software') as typeof ctx.database.schema.productSoftware.enumValues[number] | null
				const allowedSoftware = (softwareFilter ? [softwareFilter] : ['PTERODACTYL', 'CALAGOPUS']) as typeof ctx.database.schema.productSoftware.enumValues[number][]

				switch (ctx.interaction.options.getSubcommand()) {
					case "all": {
						const [ products, total ] = await Promise.all([
							ctx.database.select({
								name: ctx.database.schema.products.name,
								icon: ctx.database.schema.products.icon,
								banner: ctx.database.schema.products.banner,
								summary: ctx.database.schema.products.summary,
								version: ctx.database.schema.products.version,
								provider: ctx.database.schema.productProviders.provider,
								price: ctx.database.schema.productProviders.price,
								currency: ctx.database.schema.productProviders.currency,
								link: ctx.database.schema.productProviders.link
							}).from(ctx.database.schema.products)
								.leftJoin(ctx.database.schema.productProviders, eq(ctx.database.schema.products.id, ctx.database.schema.productProviders.productId))
								.where(inArray(ctx.database.schema.products.software, allowedSoftware))
								.orderBy(ctx.database.schema.products.id)
								.limit(ctx.database.schema.productProvider.enumValues.length),
							ctx.database.select({
								count: count(ctx.database.schema.products.id)
							}).from(ctx.database.schema.products)
								.where(inArray(ctx.database.schema.products.software, allowedSoftware))
								.then((r) => r[0].count)
						])

						return ctx.interaction.reply({
							embeds: [
								ctx.Embed()
									.setTitle(softwareFilter ? `\`📦\` ${ctx.database.properCaseSoftware(softwareFilter)} Products` : '`📦` Products')
									.setImage(products[0].banner)
									.setThumbnail(products[0].icon)
									.setDescription(ctx.join(
										`## ${products[0].name}`,
										`> \`${products[0].version}\` ${products[0].summary}`,
										'',
										'**Purchase**',
										...products.filter((product) => product.name === products[0].name).map((product) =>
											`[${ctx.database.properCaseProvider(product.provider!)}](<${product.link}>) - \`${parseFloat(product.price!).toFixed(2)} ${product.currency}\``
										)
									))
									.setFooter({ text: `${total} Products` })
							], components: ctx.paginateButtons(1, total, (type) => productsButton(ctx.interaction, allowedSoftware, null, 1, type), 1)
						})
					}

					case "linked": {
						const user = ctx.interaction.options.getUser('user') ?? ctx.interaction.user

						const [ products, total ] = await Promise.all([
							ctx.database.selectDistinct({
								id: ctx.database.schema.products.id,
								name: ctx.database.schema.products.name,
								icon: ctx.database.schema.products.icon,
								banner: ctx.database.schema.products.banner,
								summary: ctx.database.schema.products.summary,
								version: ctx.database.schema.products.version
							}).from(ctx.database.schema.products)
								.leftJoin(ctx.database.schema.productLinks, eq(ctx.database.schema.products.id, ctx.database.schema.productLinks.productId))
								.where(and(
									eq(ctx.database.schema.productLinks.discordId, user.id),
									inArray(ctx.database.schema.products.software, allowedSoftware)
								))
								.orderBy(ctx.database.schema.products.id)
								.limit(1),
							ctx.database.selectDistinct({
								count: count(ctx.database.schema.products.id)
							}).from(ctx.database.schema.products)
								.leftJoin(ctx.database.schema.productLinks, eq(ctx.database.schema.products.id, ctx.database.schema.productLinks.productId))
								.where(and(
									eq(ctx.database.schema.productLinks.discordId, user.id),
									inArray(ctx.database.schema.products.software, allowedSoftware)
								))
								.then((r) => r[0]?.count ?? 0)
						])

						if (total < 1) return ctx.interaction.reply({
							content: softwareFilter
								? `\`🔗\` No ${ctx.database.properCaseSoftware(softwareFilter)} Products linked.`
								: '`🔗` No Products linked.',
							flags: [
								MessageFlags.Ephemeral
							]
						})

						return ctx.interaction.reply({
							embeds: [
								ctx.Embed()
									.setTitle(
										softwareFilter
											? `\`📦\` Linked ${ctx.database.properCaseSoftware(softwareFilter)} Products ${user.id !== ctx.interaction.user.id ? `(of \`${user.username}\`)` : ''}`.trim()
											: `\`📦\` Linked Products ${user.id !== ctx.interaction.user.id ? `(of \`${user.username}\`)` : ''}`.trim()
									)
									.setImage(products[0].banner)
									.setThumbnail(products[0].icon)
									.setDescription(ctx.join(
										`## ${products[0].name}`,
										`> \`${products[0].version}\` ${products[0].summary}`
									))
									.setFooter({ text: `${total} Products` })
							], components: ctx.paginateButtons(1, total, (type) => productsButton(ctx.interaction, allowedSoftware, user.id, 1, type), 1)
						})
					}
				}
			}

			default: {
				switch (ctx.interaction.options.getSubcommand()) {
					case "unlink": {
						const productId = ctx.interaction.options.getInteger('product', true)

						const link = await ctx.database.select({
							productId: ctx.database.schema.productLinks.productId,
							role: ctx.database.schema.products.role
						}).from(ctx.database.schema.productLinks)
							.innerJoin(ctx.database.schema.products, eq(ctx.database.schema.productLinks.productId, ctx.database.schema.products.id))
							.where(and(
								eq(ctx.database.schema.productLinks.discordId, ctx.interaction.user.id),
								eq(ctx.database.schema.productLinks.productId, productId)
							))
							.then((r) => r[0])

						if (!link) return ctx.interaction.reply({
							content: '`🔗` Product not linked.',
							flags: [
								MessageFlags.Ephemeral
							]
						})

						await ctx.interaction.deferReply({ ephemeral: true })

						await Promise.all([
							ctx.database.delete(ctx.database.schema.productLinks)
								.where(and(
									eq(ctx.database.schema.productLinks.productId, link.productId),
									eq(ctx.database.schema.productLinks.discordId, ctx.interaction.user.id)
								)),
							ctx.interaction.guild!.members.fetch(ctx.interaction.user.id)
								.then((member) => member.roles.remove(link.role))
						])

						return ctx.interaction.editReply('`🔗` Product unlinked successfully.')
					}
				}
			}
		}
	})
	.listenAutocomplete(async(ctx) => {
		const input = ctx.interaction.options.getFocused()

		const products = await ctx.database.select({
			id: ctx.database.schema.products.id,
			name: ctx.database.schema.products.name
		}).from(ctx.database.schema.products)
			.innerJoin(ctx.database.schema.productLinks, eq(ctx.database.schema.products.id, ctx.database.schema.productLinks.productId))
			.where(and(
				ilike(ctx.database.schema.products.name, `%${input}%`),
				eq(ctx.database.schema.productLinks.discordId, ctx.interaction.user.id)
			))
			.orderBy(ctx.database.schema.products.id)
			.limit(25)

		return ctx.interaction.respond(products.map((product) => ({
			name: product.name,
			value: product.id
		})))
	})