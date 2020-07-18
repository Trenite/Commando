const { stripIndents, oneLine } = require("common-tags");
const Command = require("../base");

module.exports = class PrefixCommand extends Command {
	constructor(client) {
		super(client, {
			name: "prefix",
			group: "bot",
			memberName: "prefix",
			description: "Shows or sets the command prefix.",
			format: '[prefix/"default"/"none"]',
			examples: ["prefix", "prefix -", "prefix omg!", "prefix default", "prefix none"],

			args: [
				{
					key: "prefix",
					prompt: "What would you like to set the bot's prefix to?",
					type: "string",
					max: 15,
					default: "",
				},
			],
		});
	}

	async run(msg, args, lang) {
		// Just output the prefix
		if (!args.prefix) {
			const prefix = msg.guild ? msg.guild.commandPrefix : this.client.commandPrefix;
			return msg.reply(stripIndents`
				${prefix ? lang.currentprefix.replace("{prefix}", prefix) : lang.noprefix}
				${lang.usage.replace("{usage}", msg.anyUsage("command"))}
			`);
		}

		// Check the user's permission before changing anything
		if (msg.guild) {
			if (!msg.member.hasPermission("ADMINISTRATOR") && !this.client.isOwner(msg.author)) {
				throw lang.onlyadmin;
			}
		} else if (!this.client.isOwner(msg.author)) {
			throw lang.isowner;
		}

		// Save the prefix
		const lowercase = args.prefix.toLowerCase();
		const prefix = lowercase === "none" ? "" : args.prefix;
		let response;
		if (lowercase === "default") {
			if (msg.guild) {
				msg.guild.commandPrefix = null;
				msg.client.provider.set(msg.guild, "prefix", null);
			} else this.client.commandPrefix = null;

			const current = this.client.commandPrefix ? `\`\`${this.client.commandPrefix}\`\`` : lang.noprefixset;
			response = lang.reset.replace("{current}", current);
		} else {
			if (msg.guild) {
				msg.guild.commandPrefix = prefix;
				msg.client.provider.set(msg.guild, "prefix", prefix);
			} else this.client.commandPrefix = prefix;
			response = prefix ? lang.prefixset.replace("{prefix}", args.prefix) : lang.prefixremoved;
		}

		await msg.reply(response + lang.usagecmd.replace("{usage}", msg.anyUsage("command")));
		return null;
	}
};
