import env from "@/globals/env"
import proxmoxApi from "proxmox-api"
import { fetch, Agent } from "undici"

const agent = new Agent({
	connect: {
		rejectUnauthorized: false
	}
})

export const getClient = () => proxmoxApi({
	host: env.PROXMOX_HOST,
	fetch: (url, options) => fetch(url, {
		...options,
		dispatcher: agent,
	}),
	password: env.PROXMOX_PASSWORD
})

/**
 * Get the IP Address of a Demo Access
 * @since 1.15.0
*/ export function getIP(id: number) {
	const ip = env.PROXMOX_NET_IP.first()
	ip.rawData[3] = 10 + (id % 245)

	return ip
}