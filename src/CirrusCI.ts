import { getInput, info } from "@actions/core"
import { Context } from "@actions/github/lib/context"
import { env } from "process"
import {
	ApolloClient,
	ApolloQueryResult,
	gql,
	InMemoryCache,
	NormalizedCacheObject,
	HttpLink,
} from "@apollo/client"
import { fetch } from "cross-fetch"

const clientMutationId = "cirrus-ci-action"

export class CirrusCI {
	context: Context
	host: string
	api_url: string
	client: ApolloClient<NormalizedCacheObject>
	api_token: string
	platform: string
	owner: string
	repo: string
	branch: string

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
		this.branch = this.getBranch()
		this.api_token = env.CIRRUSCI_TOKEN!
		this.client = new ApolloClient({
			link: new HttpLink({
				uri: this.api_url,
				fetch,
				headers: {
					Authorization: `Bearer ${this.api_token}`,
				},
			}),
			cache: new InMemoryCache(),
		})
	}

	/**
	 * Split repository path into its  components, e.g.:
	 * 'github/owner/repo' -> {'github', 'owner', 'repo'}
	 *
	 *
	 * @param slug
	 */
	parseSlug(slug: string): { platform: string; owner: string; repo: string } {
		const [platform, owner, repo] = slug.split("/")
		if (!platform || !owner || !repo) {
			throw new Error(`Invalid target-slug: ${slug}`)
		}
		return { platform, owner, repo }
	}

	getBranch(): string {
		let branch = process.env.TARGET_BRANCH ?? getInput("target-branch")
		if (!branch) {
			if (this.context.ref.startsWith("refs/heads/")) {
				branch = this.context.ref.substring(11)
			} else if (this.context.ref.startsWith("refs/pull/")) {
				info(`This is a PR. Using head PR branch`)
				const pullRequestNumber = (
					this.context.ref.match(/refs\/pull\/([0-9]*)\//) as RegExpMatchArray
				)[1]
				const newref = `pull/${pullRequestNumber}/head`
				branch = newref
			}
		}
		return branch
	}

	get repository(): Promise<ApolloQueryResult<any>> {
		const graph = gql`
            query GetRepoID {
                ownerRepository(platform: "${this.platform}", owner: "${this.owner}", name: "${this.repo}"){
                    id
                }
            }
		`
		return this.client.query({ query: graph })
	}
	get repoID(): Promise<string> {
		return (async () => {
			const result = await this.repository
			return result.data.ownerRepository.id
		})()
	}

	async triggerBuild() {
		const graph = gql`
            mutation CreateBuild($repoID: ID!) {
                createBuild(
                    input: {repositoryId: $repoID, branch: "${this.branch}", clientMutationId: "${clientMutationId}"}
                ) {
                    build {
                        id
                        status
                    }
                    clientMutationId
                }
            }
		`
		const repoID = await this.repoID
		return this.client.mutate({
			mutation: graph,
			variables: { repoID },
		})
	}
}
