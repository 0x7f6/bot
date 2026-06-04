import env from "@/globals/env"
import { User } from "discord.js"
import axios from "axios"
import { network } from "@rjweb/utils"

/**
 * Format a URL
 * @since 1.17.0
*/ export function url(url: string, ip: network.IPAddress<4>): string{
	return url.replace('{}', ip.rawData[3].toString())
}

/**
 * Test the connection to the Pterodactyl panel
 * @since 1.17.0
*/ export async function testConnection(ip: network.IPAddress<4>): Promise<boolean> {
	try {
		await axios.get(`${url(env.CALAGOPUS_URL, ip)}/api/client/account`, {
			headers: {
				Authorization: `Bearer ${env.CALAGOPUS_TOKEN}`,
				Accept: 'application/json'
			},
			validateStatus: (status) => status >= 200 && status < 300
		})

		return true
	} catch {
		return false
	}
}

/**
 * Create a new User
 * @since 1.17.0
*/ export async function createUser(ip: network.IPAddress<4>, user: User, password: string): Promise<string> {
	const data = await axios.post(`${url(env.CALAGOPUS_URL, ip)}/api/admin/users`, {
		email: `demo.${user.id}@demo.panel`,
		username: 'demo',
		name_first: 'Demo',
		name_last: user.id,
		language: 'en',
		admin: true,
		password
	}, {
		headers: {
			Authorization: `Bearer ${env.CALAGOPUS_TOKEN}`,
			Accept: 'application/json'
		}
	})

	await Promise.all(env.CALAGOPUS_DEMO_SERVERS.map((server) => axios.post(`${url(env.CALAGOPUS_URL, ip)}/api/client/servers/${server}/subusers`, {
		email: `demo.${user.id}@demo.panel`,
		permissions: [
			'control.console'
		],
		ignored_files: []
	}, {
		headers: {
			Authorization: `Bearer ${env.CALAGOPUS_TOKEN}`,
			Accept: 'application/json'
		}
	})))

	return data.data.user.uuid
}