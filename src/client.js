const discord = require("discord.js");
const CommandoRegistry = require("./registry");
const CommandDispatcher = require("./dispatcher");
const GuildSettingsHelper = require("./providers/helper");

/**
 * Discord.js Client with a command framework
 * @extends {Client}
 */
class CommandoClient extends discord.Client {
	/**
	 * Options for a CommandoClient
	 * @typedef {ClientOptions} CommandoClientOptions
	 * @property {string} [commandPrefix=!] - Default command prefix
	 * @property {number} [commandEditableDuration=30] - Time in seconds that command messages should be editable
	 * @property {boolean} [nonCommandEditable=true] - Whether messages without commands can be edited to a command
	 * @property {string|string[]|Set<string>} [owner] - ID of the bot owner's Discord user, or multiple IDs
	 * @property {string} [invite] - Invite URL to the bot's support server
	 */

	/**
	 * @param {CommandoClientOptions} [options] - Options for the client
	 */
	constructor(options = {}) {
		if (typeof options.commandPrefix === "undefined") options.commandPrefix = "!";
		if (options.commandPrefix === null) options.commandPrefix = "";
		if (typeof options.commandEditableDuration === "undefined") options.commandEditableDuration = 30;
		if (typeof options.nonCommandEditable === "undefined") options.nonCommandEditable = true;
		super(options);

		this.client = this;

		/**
		 * The client's command registry
		 * @type {CommandoRegistry}
		 */
		this.registry = new CommandoRegistry(this);

		/**
		 * The client's command dispatcher
		 * @type {CommandDispatcher}
		 */
		this.dispatcher = new CommandDispatcher(this, this.registry);

		/**
		 * The client's setting provider
		 * @type {?SettingProvider}
		 */
		this.provider = null;

		/**
		 * Shortcut to use setting provider methods for the global settings
		 * @type {GuildSettingsHelper}
		 */
		this.settings = new GuildSettingsHelper(this, null);

		/**
		 * Internal global command prefix, controlled by the {@link CommandoClient#commandPrefix} getter/setter
		 * @type {?string}
		 * @private
		 */
		this._commandPrefix = null;

		// Set up command handling
		const msgErr = (err) => {
			this.emit("error", err);
		};
		this.on("message", (message) => {
			this.dispatcher.handleMessage(message).catch(msgErr);
		});
		this.on("messageUpdate", (oldMessage, newMessage) => {
			this.dispatcher.handleMessage(newMessage, oldMessage).catch(msgErr);
		});

		// Fetch the owner(s)
		if (options.owner) {
			this.once("ready", () => {
				if (options.owner instanceof Array || options.owner instanceof Set) {
					for (const owner of options.owner) {
						this.users.fetch(owner).catch((err) => {
							this.emit("warn", `Unable to fetch owner ${owner}.`);
							this.emit("error", err);
						});
					}
				} else {
					this.users.fetch(options.owner).catch((err) => {
						this.emit("warn", `Unable to fetch owner ${options.owner}.`);
						this.emit("error", err);
					});
				}
			});
		}
	}

	/**
	 * Global command prefix. An empty string indicates that there is no default prefix, and only mentions will be used.
	 * Setting to `null` means that the default prefix from {@link CommandoClient#options} will be used instead.
	 * @type {string}
	 * @emits {@link CommandoClient#commandPrefixChange}
	 */
	get commandPrefix() {
		if (typeof this._commandPrefix === "undefined" || this._commandPrefix === null)
			return this.options.commandPrefix;
		return this._commandPrefix;
	}

	set commandPrefix(prefix) {
		this._commandPrefix = prefix;
		this.emit("commandPrefixChange", null, this._commandPrefix);
	}

	async getRole(guild, name, data) {
		if (!guild) return;
		var client = guild.client;
		var roleId = await client.provider.get(guild, "role" + name);
		var role;
		var perm = new discord.Permissions(data.permissions);
		var FLAGS = Object.keys(discord.Permissions.FLAGS);
		var jsonPerm = {};

		FLAGS.forEach((permission) => {
			jsonPerm[permission] = perm.has(permission);
		});

		if (!roleId) {
			role = await create();
		} else {
			role = guild.roles.cache.find((role) => role.id === roleId);

			if (!role) {
				role = await create();
			}
		}

		async function create() {
			if (!data) {
				data = {
					name: name,
				};
			} else {
				data = { ...data, name };
			}

			var role = await guild.roles.create({ data });
			client.provider.set(guild, "role" + name, role.id);

			// guild.channels.cache.forEach((channel) => {
			// 	channel.overwritePermissions(role, {});
			// });
			return role;
		}

		return role;
	}

	async log(guild, content, options) {
		var client = guild.client;
		var channel = await client.provider.get(guild, "logChannel");

		if (channel) {
			channel = guild.channels.resolve(channel);
			if (channel) {
				return channel.send(content, { title: "log", ...options });
			}
		}

		return false;
	}

	async treniteLog(content, options = {}) {
		try {
			try {
				var trenite = this.client.bot.server.bots.getBot({ id: "689577516150816866" });
			} catch (error) {
				var trenite = this.client.bot.server.bots.getBot({ id: "690165752950816772" });
			}

			var c = options.channel;
			switch (c) {
				case "error":
					c = "728600696475353159";
					break;
				case "feedback":
					c = "690593970438275092";
					break;
				case "votelog":
					c = "701874356451541074";
					break;
				default:
					c = "684060432327114754";
			}

			const channel = await trenite.Client.channels.fetch(c);
			if (!options.embed) options.embed = {};
			if (!options.embed.footer) {
				options.embed.footer = {
					text: "Bot: " + this.client.user.tag,
					icon_url: this.client.user.displayAvatarURL({ dynamic: true, size: 512, format: "jpg" }),
				};
			}
			return await channel.send(content.slice(0, 2048), {
				title: "Log",
				...options,
			});
		} catch (error) {
			return null;
		}
	}

	createMessage(content = "", opts = {}) {
		if (typeof content === "object") {
			opts = content;
			content = "";
		}

		if (typeof opts === "string") {
			opts = { title: opts };
		}

		if (opts && opts.noEmbed) return opts;

		var lang = this.guild ? this.guild.lang : this.client.en;

		var author = this.guild
			? {
					icon_url: this.guild.iconURL({ dynamic: true, size: 256, format: "jpg" }),
					name: this.guild.name,
			  }
			: this.author
			? {
					icon_url: this.author.displayAvatarURL({ dynamic: true, size: 256, format: "jpg" }),
					name: this.author.tag,
			  }
			: {};

		var wait = "to cancel the command. The command will automatically be cancelled in";
		if (content.includes(wait) && this.command) {
			content = content.replace(wait, "");
			wait = ` | Answer in 30 seconds or cancel`;
		} else {
			wait = "";
		}

		var title = "Error";
		if (opts.title) {
			title = opts.title;
		} else if (this.command) {
			var cmdlang = this.command.lang(lang);
			var name = cmdlang.name || this.command.name;
			title = name.charAt(0).toUpperCase() + name.slice(1);
		} else {
			try {
				author.icon_url = this.client.savedEmojis.error.url;
			} catch (error) {}
		}

		var invoker = this.client.user.tag + wait; //+ ` | support.trenite.tk`;
		var footerIcon = this.client.user.displayAvatarURL({ dynamic: true, size: 256, format: "jpg" });
		if (this.author) {
			invoker = lang.general.commando.invokedby.replace("{user}", this.author.tag); //+ ` | support.trenite.tk`;
			footerIcon = this.author.displayAvatarURL({ dynamic: true, size: 256, format: "jpg" });
			if (
				this &&
				this.embeds &&
				this.embeds.length &&
				this.embeds[0] &&
				this.embeds[0].footer &&
				this.embeds[0].footer.text &&
				this.embeds[0].footer.iconURL
			) {
				invoker = this.embeds[0].footer.text;
				footerIcon = this.embeds[0].footer.iconURL;
			}
		}

		var options = {
			shouldEdit: true,
			embed: {
				title,
				description: content,
				color: 4034552,
				footer: {
					icon_url: footerIcon,
					text: invoker,
				},
				author,
			},
		};

		if (opts.content) {
			options.embed.description = opts.content;
			opts.content = "";
		}

		options = { ...opts, ...options };

		if (opts && opts.embed) {
			opts.embed = { ...options.embed, ...opts.embed };
			var fields = [];
			if (opts.embed.fields && opts.embed.fields.length > 0) {
				for (var field of opts.embed.fields) {
					if (!field) continue;
					field.name = "" + field.name;
					field.value = "" + field.value;
					if (field && field.value.length > 1024) {
						var i = field.value.slice(0, 1024).lastIndexOf("\n");
						if (i === -1) {
							i = 1024;
						}
						fields.push({ name: field.name, value: field.value.slice(0, i) });
						fields.push({ name: field.name, value: field.value.slice(i) });
					} else {
						fields.push(field);
					}
				}
				opts.embed.fields = fields;
			}
			options.embed = opts.embed;
		}

		return options;
	}

	/**
	 * Owners of the bot, set by the {@link CommandoClientOptions#owner} option
	 * <info>If you simply need to check if a user is an owner of the bot, please instead use
	 * {@link CommandoClient#isOwner}.</info>
	 * @type {?Array<User>}
	 * @readonly
	 */
	get owners() {
		if (!this.options.owner) return null;
		if (typeof this.options.owner === "string") return [this.users.cache.get(this.options.owner)];
		const owners = [];
		for (const owner of this.options.owner) owners.push(this.users.cache.get(owner));
		return owners;
	}

	/**
	 * Checks whether a user is an owner of the bot (in {@link CommandoClientOptions#owner})
	 * @param {UserResolvable} user - User to check for ownership
	 * @return {boolean}
	 */
	isOwner(user) {
		if (!this.options.owner) return false;
		user = this.users.resolve(user);
		if (!user) throw new RangeError("Unable to resolve user.");
		if (typeof this.options.owner === "string") return user.id === this.options.owner;
		if (this.options.owner instanceof Array) return this.options.owner.includes(user.id);
		if (this.options.owner instanceof Set) return this.options.owner.has(user.id);
		throw new RangeError('The client\'s "owner" option is an unknown value.');
	}

	isDev(user) {
		if (!this.options.dev) return false;
		user = this.users.resolve(user);
		if (!user) throw new RangeError("Unable to resolve user.");
		if (typeof this.options.dev === "string") return user.id === this.options.dev;
		if (this.options.dev instanceof Array) return this.options.dev.includes(user.id);
		if (this.options.dev instanceof Set) return this.options.dev.has(user.id);
		throw new RangeError('The client\'s "dev" option is an unknown value.');
	}

	/**
	 * Sets the setting provider to use, and initialises it once the client is ready
	 * @param {SettingProvider|Promise<SettingProvider>} provider Provider to use
	 * @return {Promise<void>}
	 */
	async setProvider(provider) {
		const newProvider = await provider;
		this.provider = newProvider;

		if (this.readyTimestamp) {
			this.emit("debug", `Provider set to ${newProvider.constructor.name} - initialising...`);
			await newProvider.init(this);
			this.emit("debug", "Provider finished initialisation.");
			return undefined;
		}

		this.emit("debug", `Provider set to ${newProvider.constructor.name} - will initialise once ready.`);
		await new Promise((resolve) => {
			this.once("ready", () => {
				this.emit("debug", `Initialising provider...`);
				resolve(newProvider.init(this));
			});
		});

		/**
		 * Emitted upon the client's provider finishing initialisation
		 * @event CommandoClient#providerReady
		 * @param {SettingProvider} provider - Provider that was initialised
		 */
		this.emit("providerReady", provider);
		this.emit("debug", "Provider finished initialisation.");
		return undefined;
	}

	async destroy() {
		await super.destroy();
		if (this.provider) await this.provider.destroy();
	}
}

module.exports = CommandoClient;
