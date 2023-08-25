import { getInput } from "@actions/core"
import { Context } from "@actions/github/lib/context"
import { env } from "process"

export class CirrusCIBase {
	context: Context
	host: string
	api_url: string
	api_token: string
	platform: string
	owner: string
	repo: string

	constructor(
		context: Context,
		host = env.CIRRUSCI_HOST || "api.cirrus-ci.com",
	) {
		this.context = context
		this.host = host
		this.api_url = `https://${this.host}/graphql`
		const slug = env.TARGET_SLUG ?? getInput("target-slug")
		const { platform, owner, repo } = slug
			? this.parseSlug(slug)
			: { platform: "github", ...context.repo }
		this.platform = platform
		this.owner = owner
		this.repo = repo
		this.api_token = env.CIRRUSCI_TOKEN!
	}

	/**
	 * Split repository path into its  components, e.g.:
	 * 'github/owner/repo' -> {'github', 'owner', 'repo'}
	 *
	 *
	 * @param slug
	 */
	parseSlug(slug: string) {
		const [platform, owner, repo] = slug.split("/")
		if (!platform || !owner || !repo) {
			throw new Error(`Invalid target-slug: ${slug}`)
		}
		return { platform, owner, repo }
	}
}
