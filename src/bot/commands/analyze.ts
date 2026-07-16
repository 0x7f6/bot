import Command from "@/bot/command"
import { eq } from "drizzle-orm"
import { InteractionContextType, MessageFlags, PermissionFlagsBits } from "discord.js"
import axios from "axios"

type PterodactylResponse = {
	[i: string]: {
		version: string
		engine: string
		timestamp: number
		target: string
	}
}

type CalagopusResponse = {
	nonce: string
	user: string
	timestamp: number
}

type Product = {
	name: string
	identifier: string
}

function retry<T>(fn: () => Promise<T>, max = 5, delay = 500): Promise<T | null> {
	return fn().catch((err) => {
		if (max <= 0) return null

		return new Promise<T | null>((resolve) => setTimeout(() => resolve(retry(fn, max - 1, delay)), delay))
	})
}

export default new Command()
	.build((builder) => builder
		.setName('analyze')
		.setContexts(InteractionContextType.Guild)
		.setDescription('Analyze products/purchases of a panel')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addSubcommand((command) => command
			.setName('pterodactyl')
			.setDescription('Analyze products/purchases of a Pterodactyl panel')
			.addStringOption((option) => option
				.setName('url')
				.setDescription('The url of the panel to detect products on')
				.setRequired(true)
			)
		)
		.addSubcommand((command) => command
			.setName('calagopus')
			.setDescription('Analyze products/purchases of a Calagopus panel')
			.addStringOption((option) => option
				.setName('url')
				.setDescription('The url of the panel to detect products on')
				.setRequired(true)
			)
		)
	)
	.listen(async(ctx) => {
		if (!ctx.interaction.guild) return

		const url = ctx.interaction.options.getString('url', true)

		switch (ctx.interaction.options.getSubcommand()) {
			case "pterodactyl": {
				try {
					const parsed = new URL(url),
						products = await ctx.database.select({
							name: ctx.database.schema.products.name,
							identifier: ctx.database.schema.products.identifier
						})
							.from(ctx.database.schema.products)
							.where(eq(ctx.database.schema.products.software, 'PTERODACTYL'))

					await ctx.interaction.deferReply({ flags: [MessageFlags.Ephemeral] })

					const detected: [Product, boolean, PterodactylResponse | string, typeof ctx.database.schema.productProvider.enumValues[number]][] = await Promise.all(products.map(async(product) => {
						const response = await retry(() => axios.get<string | PterodactylResponse>(`${parsed.origin}/extensions/${product.identifier}`))

						if (!response?.data || (typeof response.data === 'string' && response.data.length > 200)) return

						if (typeof response.data === 'string') {
							const platform = response.data.length === 32 ? 'BUILTBYBIT' : 'SOURCEXCHANGE'

							return [product, response.data === '%%__NONCE__%%', response.data, platform]
						} else {
							const identifier = Object.keys(response.data)[0],
								nonce = identifier.split(':')[0]

							const platform = nonce.length === 32 ? 'BUILTBYBIT' : 'SOURCEXCHANGE'

							return [product, identifier.includes('%%__NONCE__%%'), response.data, platform]
						}
					})).then((r) => r.filter(Boolean)) as any

					if (detected.length < 1) return ctx.interaction.editReply(`\`🔗\` No products detected on \`${parsed.origin}\``)

					return ctx.interaction.editReply({
						embeds: [
							ctx.Embed()
								.setTitle(`\`🔗\` Detected Products (${detected.length}) on \`${parsed.origin}\``)
								.setDescription(ctx.join(
									...detected.flatMap(([product, dev, data, platform], i) => [
										`\`#${i + 1}\` **${product.name}**${dev ? ' `DEV VERSION`' : ''}`,
										...!data ? [] : [
											typeof data === 'object'
												? `> \`nonce: ${Object.keys(data)[0].split(':')[0]}\` \`user: ${Object.keys(data)[0].split(':')[1]}\` \`platform: ${platform}\``
												: `> \`nonce: ${data}\` \`platform: ${platform}\``,
											...typeof data === 'object' ? [
												'```json',
												JSON.stringify({
													...data[Object.keys(data)[0]],
													timestamp: new Date(data[Object.keys(data)[0]].timestamp * 1000).toLocaleString()
												}, null, 2),
												'```'
											] : []
										],
										''
									])
								))
						]
					})
				} catch {
					return ctx.interaction.reply({
						content: '`🔗` Invalid URL.',
						flags: [
							MessageFlags.Ephemeral
						]
					})
				}
			}

			case "calagopus": {
				try {
					const parsed = new URL(url),
						products = await ctx.database.select({
							name: ctx.database.schema.products.name,
							identifier: ctx.database.schema.products.identifier
						})
							.from(ctx.database.schema.products)
							.where(eq(ctx.database.schema.products.software, 'CALAGOPUS'))

					await ctx.interaction.deferReply({ flags: [MessageFlags.Ephemeral] })

					const detected: [Product, boolean, CalagopusResponse, typeof ctx.database.schema.productProvider.enumValues[number]][] = await Promise.all(products.map(async(product) => {
						const response = await retry(() => axios.get<CalagopusResponse>(`${parsed.origin}/2038/${product.identifier}`))

						if (!response?.data || typeof response.data !== 'object' || typeof response.data.nonce !== 'string') return

						const platform = response.data.nonce.length === 32 ? 'BUILTBYBIT' : 'SOURCEXCHANGE'

						return [product, response.data.nonce === '%%__NONCE__%%', response.data, platform]
					})).then((r) => r.filter(Boolean)) as any

					if (detected.length < 1) return ctx.interaction.editReply(`\`🔗\` No products detected on \`${parsed.origin}\``)

					return ctx.interaction.editReply({
						embeds: [
							ctx.Embed()
								.setTitle(`\`🔗\` Detected Products (${detected.length}) on \`${parsed.origin}\``)
								.setDescription(ctx.join(
									...detected.flatMap(([product, dev, data, platform], i) => [
										`\`#${i + 1}\` **${product.name}**${dev ? ' `DEV VERSION`' : ''}`,
										`> \`nonce: ${data.nonce}\` \`user: ${data.user}\` \`platform: ${platform}\``,
										'```json',
										JSON.stringify({
											...data,
											timestamp: new Date(data.timestamp * 1000).toLocaleString()
										}, null, 2),
										'```',
										''
									])
								))
						]
					})
				} catch {
					return ctx.interaction.reply({
						content: '`🔗` Invalid URL.',
						flags: [
							MessageFlags.Ephemeral
						]
					})
				}
			}
		}
	})
