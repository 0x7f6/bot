import Event from "@/bot/event"
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Message } from "discord.js"
import axios from "axios"
import { size } from "@rjweb/utils"
import { createWorker } from "tesseract.js"
import { and, eq, sql } from "drizzle-orm"
import diagnose from "../buttons/tickets/open"

const commonFileExtensions: Record<string, string> = Object.freeze({
	'txt': 'text/plain',
	'log': 'text/plain',
	'ts': 'text/typescript',
	'tsx': 'text/typescript',
	'js': 'text/javascript',
	'jsx': 'text/javascript',
	'yaml': 'text/yaml',
	'json': 'application/json',
	'html': 'text/html',
	'css': 'text/css',
	'py': 'text/python',
	'rb': 'text/ruby',
	'java': 'text/java',
	'php': 'text/php',
	'go': 'text/go',
	'rs': 'text/rust',
	'xml': 'application/xml',
	'sql': 'text/sql',
	'c': 'text/c',
	'cpp': 'text/cpp',
	'h': 'text/cpp',
	'cs': 'text/csharp',
	'sh': 'text/shell',
})

const commonFileExtensionsArr = Object.keys(commonFileExtensions)

const ocrContentTypes = Object.freeze(['image/png', 'image/jpeg', 'image/bmp', 'image/webp', 'image/gif'])

export default new Event()
	.listenTo((events) => events.MessageCreate)
	.listen<Message>(async(ctx) => {
		const attachments = ctx.interaction.attachments.filter((a) => !a.width && a.size < size(10).mb() && commonFileExtensionsArr.includes(a.name.split('.').pop() || 'txt'))
		const urls: [string, string][] = []

		await Promise.all(attachments.map(async(a) => {
			const { data: content } = await axios.get<string>(a.url)
			if (typeof content !== 'string' && typeof content !== 'object') return

			const { data } = await axios.post<{
				key: string
			}>('https://api.pastes.dev/post', typeof content === 'string' ? content : JSON.stringify(content, undefined, 2), {
				headers: {
					'Content-Type': commonFileExtensions[a.name.split('.').pop() || 'txt'] || 'text/plain'
				}
			})

			urls.push([a.name, `https://pastes.dev/${data.key}`])
		}))

		if (urls.length) {
			await ctx.interaction.reply({
				content: urls.map(([name, url]) => `[\`${name} ↗\`](<${url}>)`).join(' '),
				allowedMentions: { repliedUser: false }
			})
		}

		if (ctx.interaction.content === 's!diagnose') {
			await ctx.interaction.reply({
				components: [
					new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setLabel('sus')
								.setStyle(ButtonStyle.Primary)
								.setCustomId(diagnose(ctx.interaction))
						) as any
				]
			})
		}

		if (ctx.interaction.channel.type === ChannelType.GuildText) {
			let error = ctx.interaction.content.concat(' ')

			const images = ctx.interaction.attachments.filter((a) => a.contentType && ocrContentTypes.includes(a.contentType) && a.size < size(10).mb())
			if (images.size) {
				error += await Promise.all(images.map(async(a) => {
					const { data: buffer } = await axios.get<Buffer>(a.url, { responseType: 'arraybuffer' }),
						worker = await createWorker('eng', 1, { errorHandler: () => {} })

					const data = await worker.recognize(buffer)
						.catch(() => null)
						.finally(() => worker.terminate())

					return data?.data.text
				})).then((words) => words.join(' '))
			}

			const pastes = error.match(/https:\/\/pastes\.dev\/[a-zA-Z0-9]+/g)
			if (pastes?.length) {
				error += await Promise.all(pastes.slice(0, 3).map(async(p) => {
					const data = await axios.get<string>(p.replace('pastes.dev', 'api.pastes.dev'), {
						maxContentLength: size(2.5).mb()
					}).catch(() => null)

					return data?.data
				})).then((contents) => contents.join(' '))
			}

			if (error.length > 5) {
				const errorResolution = await ctx.support.findSolutionToAutomaicError(error)

				if (errorResolution) {
					await ctx.interaction.reply(errorResolution)
				}
			}
		}
	})