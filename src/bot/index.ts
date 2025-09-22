import { ActionRowBuilder, AutocompleteInteraction, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, Client, DiscordAPIError, EmbedBuilder, GatewayIntentBits, MessageCreateOptions, MessageEditOptions, MessagePayload, version } from "discord.js"
import { filesystem } from "@rjweb/utils"
import * as Sentry from "@sentry/node"
import * as customid from "@/globals/customid"
import logger from "@/globals/logger"
import database from "@/globals/database"
import { eq } from "drizzle-orm"
import env from "@/globals/env"

import Context from "@/bot/context"
import Event from "@/bot/event"
import Command from "@/bot/command"
import Button from "@/bot/button"
import Modal from "@/bot/modal"
import Select from "@/bot/select"

const startTime = performance.now()
export const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
})

const events: Event[] = []
const commands: Command[] = []
const buttons: Button[] = []
const modals: Modal[] = []
const selects: Select[] = []

function parseOptions(options: (AutocompleteInteraction | ChatInputCommandInteraction)['options']) {
	const output: Record<string, string> = {}

	if (!options.getSubcommand(false)) {
		Object.assign(output, ...options.data.map((option) => ({ [option.name]: option.value })))
	} else if (options.getSubcommandGroup(false)) {
		Object.assign(output, ...options.data[0].options?.[0].options?.map((option) => ({ [option.name]: option.value })) ?? [])
	} else {
		Object.assign(output, ...options.data[0].options?.map((option) => ({ [option.name]: option.value })) ?? [])
	}

	return output
}

client.on('interactionCreate', async (interaction) => {
	if (!interaction.guild) return

	const startTime = performance.now()

	const scope = new Sentry.Scope()

	scope
		.setLevel('log')
		.setSpan(Sentry.startTransaction({
			name: 'interactionCreate'
		}))
		.setUser({
			id: interaction.user.id
		})

	const transaction = scope.getTransaction()!

	if (interaction.isChatInputCommand()) {
		const command = commands.find((command) => command['builder'].name === interaction.commandName)
		if (!command || !interaction.guildId) return

		const commandName = [interaction.commandName, interaction.options.getSubcommandGroup(false), interaction.options.getSubcommand(false)].filter(Boolean).join(' '),
			options = parseOptions(interaction.options)

		transaction.setName(`command {/${commandName}}`)

		const context = new Context(interaction, scope)
		context['startTime'] = startTime

		error: try {
			await Promise.resolve(command['listener'](context))
		} catch (error: any) {
			if (error instanceof DiscordAPIError) {
				if (error.code === 10062) break error
			}

			if (typeof error !== 'string') logger()
				.text('Discord Command Error')
				.text('\n')
				.text(error.stack ?? error.toString(), (c) => c.red)
				.error()

			if (typeof error !== 'string') Sentry.captureException(error, scope)

			try {
				await interaction[interaction.deferred ? 'editReply' : 'reply']({
					ephemeral: true,
					content: typeof error === 'string' ? error : '`⚠️` An error occurred while processing the command.'
				})
			} catch { }
		}

		transaction.finish()

		logger()
			.text('DISCORD COMMAND', (c) => c.blue)
			.text(':')
			.text(`/${commandName}`, (c) => c.green)
			.text(`@${interaction.user.username}`, (c) => c.cyan)
			.text(JSON.stringify(options), (c) => c.magenta)
			.text(`(${(performance.now() - startTime).toFixed(1)}ms)`, (c) => c.gray)
			.info()
	} else if (interaction.isAutocomplete()) {
		const command = commands.find((command) => command['builder'].name === interaction.commandName)
		if (!command || !interaction.guildId) return

		const commandName = [interaction.commandName, interaction.options.getSubcommandGroup(false), interaction.options.getSubcommand(false)].filter(Boolean).join(' '),
			options = parseOptions(interaction.options)

		transaction.setName(`autocomplete {/${commandName}}`)
		transaction.setAttributes({
			options: JSON.stringify(options)
		})

		const context = new Context(interaction, scope)
		context['startTime'] = startTime
		error: try {
			await Promise.resolve((command['autocomplete'] as any)(context))
		} catch (error: any) {
			if (error instanceof DiscordAPIError) {
				if (error.code === 10062) break error
			}

			logger()
				.text('Discord Autocomplete Error')
				.text('\n')
				.text(error.stack ?? error.toString(), (c) => c.red)
				.error()

			Sentry.captureException(error, scope)
		} finally {
			transaction.finish()
		}

		logger()
			.text('DISCORD AUTOCOMPLETE', (c) => c.blue)
			.text(':')
			.text(`/${commandName}`, (c) => c.green)
			.text(`@${interaction.user.username}`, (c) => c.cyan)
			.text(JSON.stringify(options), (c) => c.magenta)
			.text(`(${(performance.now() - startTime).toFixed(1)}ms)`, (c) => c.gray)
			.info()
	} else if (interaction.isButton()) {
		if (!interaction.guildId) return

		let decoded = await customid.decode(interaction.client.user.id.concat(interaction.guildId), interaction.customId)
		if (!decoded) decoded = interaction.customId

		const [name, ...args] = decoded.split('°').filter(Boolean)

		const button = buttons.find((button) => button['m_name'] === name)
		if (!button) return

		const options = args.map((arg) => JSON.parse(arg.replace(/%C2%B0|%5E/g, (c) => decodeURIComponent(c))))

		transaction.setName(`button {${button['m_name']}}`)
		transaction.setAttributes({
			options: JSON.stringify(options)
		})

		const context = new Context(interaction, scope)
		context['startTime'] = startTime

		error: try {
			await Promise.resolve((button['listener'] as any)(context, ...args.map((arg) => JSON.parse(arg))))
		} catch (error: any) {
			if (error instanceof DiscordAPIError) {
				if (error.code === 10062) break error
			}

			if (typeof error !== 'string') logger()
				.text('Discord Button Error')
				.text('\n')
				.text(error.stack ?? error.toString(), (c) => c.red)
				.error()

			if (typeof error !== 'string') Sentry.captureException(error, scope)

			try {
				await interaction.reply({
					ephemeral: true,
					content: typeof error === 'string' ? error : '`⚠️` An error occurred while processing the button.'
				})
			} catch { }
		} finally {
			transaction.finish()
		}

		logger()
			.text('DISCORD BUTTON', (c) => c.blue)
			.text(':')
			.text(`${button['m_name']}`, (c) => c.green)
			.text(`@${interaction.user.username}`, (c) => c.cyan)
			.text(JSON.stringify(options), (c) => c.magenta)
			.text(`(${(performance.now() - startTime).toFixed(1)}ms)`, (c) => c.gray)
			.info()
	} else if (interaction.isModalSubmit()) {
		if (!interaction.guildId) return

		const decoded = await customid.decode(interaction.client.user.id.concat(interaction.guildId), interaction.customId)
		if (!decoded) return

		const [modalRawArgs, listenerRawArgs] = decoded.split('^')
		const [name, ...modalArgs] = modalRawArgs.split('°').filter(Boolean)
		const listenerArgs = listenerRawArgs.split('°').filter(Boolean)

		const modal = modals.find((modal) => modal['m_name'] === name)
		if (!modal) return

		const modalOptions = modalArgs.map((arg) => JSON.parse(arg.replace(/%C2%B0|%5E/g, (c) => decodeURIComponent(c)))),
			listenerOptions = listenerArgs.map((arg) => JSON.parse(arg.replace(/%C2%B0|%5E/g, (c) => decodeURIComponent(c))))

		transaction.setName(`modal {${modal['m_name']}}`)
		transaction.setAttributes({
			modalOptions: JSON.stringify(modalOptions),
			listenerOptions: JSON.stringify(listenerOptions)
		})

		const context = new Context(interaction, scope)
		context['startTime'] = startTime

		error: try {
			await Promise.resolve((modal['listener'] as any)(context, ...listenerOptions))
		} catch (error: any) {
			if (error instanceof DiscordAPIError) {
				if (error.code === 10062) break error
			}

			if (typeof error !== 'string') logger()
				.text('Discord Modal Error')
				.text('\n')
				.text(error.stack ?? error.toString(), (c) => c.red)
				.error()

			if (typeof error !== 'string') Sentry.captureException(error, scope)

			try {
				await interaction.reply({
					ephemeral: true,
					content: typeof error === 'string' ? error : '`⚠️` An error occurred while processing the modal.'
				})
			} catch { }
		} finally {
			transaction.finish()
		}

		logger()
			.text('DISCORD MODAL', (c) => c.blue)
			.text(':')
			.text(`${modal['m_name']}`, (c) => c.cyan)
			.text(`(${(performance.now() - startTime).toFixed(1)}ms)`, (c) => c.gray)
			.info()
	} else if (interaction.isStringSelectMenu()) {
		if (!interaction.guildId) return

		const decoded = await customid.decode(interaction.client.user.id, interaction.customId)
		if (!decoded) return

		const [name, ...listenerArgs] = decoded.split('°').filter(Boolean)

		const select = selects.find((select) => select['m_name'] === name)
		if (!select) return

		const listenerOptions = listenerArgs.map((arg) => JSON.parse(arg.replace(/%C2%B0|%5E/g, (c) => decodeURIComponent(c))))

		transaction.setName(`select {${select['m_name']}}`)
		transaction.setAttributes({
			listenerOptions: JSON.stringify(listenerOptions)
		})

		const context = new Context(interaction, scope)
		context['startTime'] = startTime

		error: try {
			await Promise.resolve((select['listener'] as any)(context, ...listenerOptions))
		} catch (error: any) {
			if (error instanceof DiscordAPIError) {
				if (error.code === 10062) break error
			}

			if (typeof error !== 'string') logger()
				.text('Discord Modal Error')
				.text('\n')
				.text(error.stack ?? error.toString(), (c) => c.red)
				.error()

			if (typeof error !== 'string') Sentry.captureException(error, scope)

			try {
				await interaction.reply({
					ephemeral: true,
					content: typeof error === 'string' ? error : '`⚠️` An error occurred while processing the select.'
				})
			} catch { }
		} finally {
			transaction.finish()
		}

		logger()
			.text('DISCORD MODAL', (c) => c.blue)
			.text(':')
			.text(`${select['m_name']}`, (c) => c.cyan)
			.text(`(${(performance.now() - startTime).toFixed(1)}ms)`, (c) => c.gray)
			.info()
	}
})

async function main() {
	await Promise.all([
		Promise.all([...filesystem.getFiles(`${__dirname}/events`, { recursive: true }).filter((file) => file.endsWith('js')).map(async (file) => events.push((await import(file)).default.default))]),
		Promise.all([...filesystem.getFiles(`${__dirname}/commands`, { recursive: true }).filter((file) => file.endsWith('js')).map(async (file) => commands.push((await import(file)).default.default))]),
		Promise.all([...filesystem.getFiles(`${__dirname}/buttons`, { recursive: true }).filter((file) => file.endsWith('js')).map(async (file) => buttons.push((await import(file)).default.default))]),
		Promise.all([...filesystem.getFiles(`${__dirname}/modals`, { recursive: true }).filter((file) => file.endsWith('js')).map(async (file) => modals.push((await import(file)).default.default))]),
		Promise.all([...filesystem.getFiles(`${__dirname}/selects`, { recursive: true }).filter((file) => file.endsWith('js')).map(async (file) => selects.push((await import(file)).default.default))])
	])

	for (const event of events) {
		client.on(event['event'] as any, async (interaction, ...rest) => {
			const scope = new Sentry.Scope()

			scope
				.setLevel('log')
				.setSpan(Sentry.startTransaction({
					name: `event {${event['event']}}`
				}))

			const transaction = scope.getTransaction()!

			const context = new Context(interaction, scope)
			context['startTime'] = performance.now()

			try {
				await Promise.resolve(event['listener'](context, ...rest))
			} catch (error: any) {
				Sentry.captureException(error, scope)

				logger()
					.text('Discord Event Error')
					.text('\n')
					.text(error.stack ?? error.toString(), (c) => c.red)
					.error()
			} finally {
				transaction.finish()
			}

			logger()
				.text('DISCORD EVENT', (c) => c.blue)
				.text(':')
				.text(`${event['event']}`, (c) => c.cyan)
				.text(`(${(performance.now() - context['startTime']).toFixed(1)}ms)`, (c) => c.gray)
				.info()
		})
	}

	await client.login(env.BOT_TOKEN).then(async () => {
		await client.application?.commands.set(commands.map((command) => command['builder'].toJSON()))

		logger()
			.text('Discord', (c) => c.blueBright)
			.text(`(${version}) Connection established!`)
			.text(`(${(performance.now() - startTime).toFixed(1)}ms) (${commands.length} registered Commands)`, (c) => c.gray)
			.info()

		const sendMessages = await database.select({
			id: database.schema.sendMessages.id,
			discordId: database.schema.sendMessages.discordId,
			discordChannelId: database.schema.sendMessages.discordChannelId,
			message: database.schema.sendMessages.message,
			icon: database.schema.sendMessages.icon,
			image: database.schema.sendMessages.image,
			ticket: database.schema.sendMessages.ticket
		})
			.from(database.schema.sendMessages)
			.where(eq(database.schema.sendMessages.enabled, true))

		for (const sendMessage of sendMessages) {
			logger()
				.text('Sending message to')
				.text(sendMessage.discordChannelId, (c) => c.cyan)
				.text('...')
				.info()

			const channel = await client.channels.fetch(sendMessage.discordChannelId).catch(() => null)
			if (!channel || !channel.isSendable()) continue

			const data: MessageCreateOptions & MessageEditOptions = {
				embeds: [
					new EmbedBuilder()
						.setDescription(sendMessage.message)
						.setImage(sendMessage.image)
						.setThumbnail(sendMessage.icon)
				], components: !sendMessage.ticket ? [] : [
					new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setLabel('Open Ticket')
								.setStyle(ButtonStyle.Primary)
								.setEmoji('1150889684227076227')
								.setCustomId('ticket-open')
						) as any
				]
			}

			if (sendMessage.discordId) {
				const message = await channel.messages.fetch(sendMessage.discordId).catch(() => null)

				if (message) {
					await message.edit(data).catch(() => null)
				} else {
					sendMessage.discordId = null
				}
			}

			if (!sendMessage.discordId) {
				const message = await channel.send(data)

				await database.update(database.schema.sendMessages)
					.set({ discordId: message.id })
					.where(eq(database.schema.sendMessages.id, sendMessage.id))
			}

			logger()
				.text('Sent message to', (c) => c.green)
				.text(sendMessage.discordChannelId, (c) => c.cyan)
				.info()
		}
	}).catch((err) => {
		logger()
			.text('Discord', (c) => c.redBright)
			.text('Connection failed')
			.text('\n')
			.text(err.stack!, (c) => c.red)
			.error()
	})
}

main()