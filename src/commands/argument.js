const { escapeMarkdown } = require("discord.js");
const { oneLine, stripIndents } = require("common-tags");
const ArgumentUnionType = require("../types/union");

/** A fancy argument */
class Argument {
	/**
	 * @typedef {Object} ArgumentInfo
	 * @property {string} key - Key for the argument
	 * @property {string} [label=key] - Label for the argument
	 * @property {string} prompt - First prompt for the argument when it wasn't specified
	 * @property {string} [error] - Predefined error message to output for the argument when it isn't valid
	 * @property {string} [type] - Type of the argument (must be the ID of one of the registered argument types
	 * or multiple IDs in order of priority separated by `|` for a union type - see
	 * {@link CommandoRegistry#registerDefaultTypes} for the built-in types)
	 * @property {number} [max] - If type is `integer` or `float`, this is the maximum value of the number.
	 * If type is `string`, this is the maximum length of the string.
	 * @property {number} [min] - If type is `integer` or `float`, this is the minimum value of the number.
	 * If type is `string`, this is the minimum length of the string.
	 * @property {ArgumentDefault} [default] - Default value for the argument (makes the arg optional - cannot be `null`)
	 * @property {string[]} [oneOf] - An array of values that are allowed to be used
	 * @property {Function} [validate] - Validator function for the argument (see {@link ArgumentType#validate})
	 * @property {Function} [parse] - Parser function for the argument (see {@link ArgumentType#parse})
	 * @property {Function} [isEmpty] - Empty checker for the argument (see {@link ArgumentType#isEmpty})
	 * @property {number} [wait=30] - How long to wait for input (in seconds)
	 */

	/**
	 * Either a value or a function that returns a value. The function is passed the CommandoMessage and the Argument.
	 * @typedef {*|Function} ArgumentDefault
	 */

	/**
	 * @param {CommandoClient} client - Client the argument is for
	 * @param {ArgumentInfo} info - Information for the command argument
	 */
	constructor(client, info) {
		this.constructor.validateInfo(client, info);

		/**
		 * Key for the argument
		 * @type {string}
		 */
		this.key = info.key;

		/**
		 * Label for the argument
		 * @type {string}
		 */
		this.label = info.label || info.key;

		/**
		 * Question prompt for the argument
		 * @type {string}
		 */
		this.prompt = info.prompt;

		/**
		 * Error message for when a value is invalid
		 * @type {?string}
		 */
		this.error = info.error || null;

		/**
		 * Type of the argument
		 * @type {?ArgumentType}
		 */
		this.type = this.constructor.determineType(client, info.type);

		/**
		 * If type is `integer` or `float`, this is the maximum value of the number.
		 * If type is `string`, this is the maximum length of the string.
		 * @type {?number}
		 */
		this.max = typeof info.max !== "undefined" ? info.max : null;

		/**
		 * If type is `integer` or `float`, this is the minimum value of the number.
		 * If type is `string`, this is the minimum length of the string.
		 * @type {?number}
		 */
		this.min = typeof info.min !== "undefined" ? info.min : null;

		/**
		 * The default value for the argument
		 * @type {?ArgumentDefault}
		 */
		this.default = typeof info.default !== "undefined" ? info.default : null;

		/**
		 * Values the user can choose from
		 * If type is `string`, this will be case-insensitive
		 * If type is `channel`, `member`, `role`, or `user`, this will be the IDs.
		 * @type {?string[]}
		 */
		this.oneOf = typeof info.oneOf !== "undefined" ? info.oneOf : null;

		/**
		 * Validator function for validating a value for the argument
		 * @type {?Function}
		 * @see {@link ArgumentType#validate}
		 */
		this.validator = info.validate || null;

		/**
		 * Parser function for parsing a value for the argument
		 * @type {?Function}
		 * @see {@link ArgumentType#parse}
		 */
		this.parser = info.parse || null;

		/**
		 * Function to check whether a raw value is considered empty
		 * @type {?Function}
		 * @see {@link ArgumentType#isEmpty}
		 */
		this.emptyChecker = info.isEmpty || null;

		/**
		 * How long to wait for input (in seconds)
		 * @type {number}
		 */
		this.wait = typeof info.wait !== "undefined" ? info.wait : 30;
	}

	/**
	 * Result object from obtaining a single {@link Argument}'s value(s)
	 * @typedef {Object} ArgumentResult
	 * @property {?*|?Array<*>} value - Final value(s) for the argument
	 * @property {?string} cancelled - One of:
	 * - `user` (user cancelled)
	 * - `time` (wait time exceeded)
	 * - `promptLimit` (prompt limit exceeded)
	 * @property {Message[]} prompts - All messages that were sent to prompt the user
	 * @property {Message[]} answers - All of the user's messages that answered a prompt
	 */

	/**
	 * Prompts the user and obtains the value for the argument
	 * @param {CommandoMessage} msg - Message that triggered the command
	 * @param {string} [val] - Pre-provided value for the argument
	 * @param {number} [promptLimit=Infinity] - Maximum number of times to prompt for the argument
	 * @return {Promise<ArgumentResult>}
	 */
	async obtain(msg, val, promptLimit = Infinity) {
		let empty = this.isEmpty(val, msg);
		if (empty && this.default !== null) {
			return {
				value: typeof this.default === "function" ? await this.default(msg, this) : this.default,
				cancelled: null,
				prompts: [],
				answers: [],
			};
		}

		const wait = this.wait > 0 && this.wait !== Infinity ? this.wait * 1000 : undefined;
		const prompts = [];
		const answers = [];
		let valid = !empty ? await this.validate(val, msg) : false;

		while (!valid || typeof valid === "string") {
			/* eslint-disable no-await-in-loop */
			if (prompts.length >= promptLimit) {
				return {
					value: null,
					cancelled: "promptLimit",
					prompts,
					answers,
				};
			}

			var description = msg.command.description;
			var prompt = this.prompt;
			var lang = msg.guild ? msg.guild.lang : msg.client.en;
			try {
				var { invalidlabel, cancelcmd, autocancel } = lang.general.commando;
				var translation = lang.commands[msg.command.groupID][msg.command.name];
				description = translation.description;
				prompt = translation.args[this.key];
			} catch (e) {}

			var text = stripIndents`__${description}__
			
				**${prompt}**
				${empty ? "" : valid ? valid : `\n__**${invalidlabel.replace("{label}", this.label)}**__\n`}
				_${oneLine`
					${cancelcmd}
					${wait ? autocancel.replace("{wait}", this.wait) : ""}
				`}_`;

			if (prompts.length <= 0) {
				prompts.push(await msg.reply(text));
			} else {
				prompts[0].edit(text, { title: msg.command.name.charAt(0).toUpperCase() + msg.command.name.slice(1) });
			}

			// Get the user's response
			const responses = await msg.channel.awaitMessages((msg2) => msg2.author.id === msg.author.id, {
				max: 1,
				time: wait,
			});
			if (responses.first() && responses.first().deletable) responses.first().delete();

			// Make sure they actually answered
			if (responses && responses.size === 1) {
				answers.push(responses.first());
				val = answers[answers.length - 1].content;
			} else {
				return {
					value: null,
					cancelled: "time",
					prompts,
					answers,
				};
			}

			if (msg.guild) {
				var startsWith = val.startsWith(msg.guild.commandPrefix);
				startsWith = val.slice(msg.guild.commandPrefix.length).split(" ")[0];

				if (Client.registry.commands.get(startsWith)) {
					var command = true;
				}
			}

			// See if they want to cancel
			if (val.toLowerCase() === "cancel" || command) {
				return {
					value: null,
					cancelled: "user",
					prompts,
					answers,
				};
			}

			empty = this.isEmpty(val, msg);
			valid = await this.validate(val, msg);
			/* eslint-enable no-await-in-loop */
		}

		if (prompts[0] && prompts[0].deletable) prompts[0].delete();

		return {
			value: await this.parse(val, msg),
			cancelled: null,
			prompts,
			answers,
		};
	}

	/**
	 * Checks if a value is valid for the argument
	 * @param {string} val - Value to check
	 * @param {CommandoMessage} msg - Message that triggered the command
	 * @return {boolean|string|Promise<boolean|string>}
	 */
	validate(val, msg) {
		const valid = this.validator ? this.validator(val, msg, this) : this.type.validate(val, msg, this);
		if (!valid || typeof valid === "string") return this.error || valid;
		if (valid instanceof Promise)
			return valid.then((vld) => (!vld || typeof vld === "string" ? this.error || vld : vld));
		return valid;
	}

	/**
	 * Parses a value string into a proper value for the argument
	 * @param {string} val - Value to parse
	 * @param {CommandoMessage} msg - Message that triggered the command
	 * @return {*|Promise<*>}
	 */
	parse(val, msg) {
		if (this.parser) return this.parser(val, msg, this);
		return this.type.parse(val, msg, this);
	}

	/**
	 * Checks whether a value for the argument is considered to be empty
	 * @param {string} val - Value to check for emptiness
	 * @param {CommandoMessage} msg - Message that triggered the command
	 * @return {boolean}
	 */
	isEmpty(val, msg) {
		if (this.emptyChecker) return this.emptyChecker(val, msg, this);
		if (this.type) return this.type.isEmpty(val, msg, this);
		if (Array.isArray(val)) return val.length === 0;
		return !val;
	}

	/**
	 * Validates the constructor parameters
	 * @param {CommandoClient} client - Client to validate
	 * @param {ArgumentInfo} info - Info to validate
	 * @private
	 */
	static validateInfo(client, info) {
		// eslint-disable-line complexity
		if (!client) throw new Error("The argument client must be specified.");
		if (typeof info !== "object") throw new TypeError("Argument info must be an Object.");
		if (typeof info.key !== "string") throw new TypeError("Argument key must be a string.");
		if (info.label && typeof info.label !== "string") throw new TypeError("Argument label must be a string.");
		if (typeof info.prompt !== "string") throw new TypeError("Argument prompt must be a string.");
		if (info.error && typeof info.error !== "string") throw new TypeError("Argument error must be a string.");
		if (info.type && typeof info.type !== "string") throw new TypeError("Argument type must be a string.");
		if (info.type && !info.type.includes("|") && !client.registry.types.has(info.type)) {
			throw new RangeError(`Argument type "${info.type}" isn't registered.`);
		}
		if (!info.type && !info.validate) {
			throw new Error('Argument must have either "type" or "validate" specified.');
		}
		if (info.validate && typeof info.validate !== "function") {
			throw new TypeError("Argument validate must be a function.");
		}
		if (info.parse && typeof info.parse !== "function") {
			throw new TypeError("Argument parse must be a function.");
		}
		if (!info.type && (!info.validate || !info.parse)) {
			throw new Error("Argument must have both validate and parse since it doesn't have a type.");
		}
		if (typeof info.wait !== "undefined" && (typeof info.wait !== "number" || Number.isNaN(info.wait))) {
			throw new TypeError("Argument wait must be a number.");
		}
	}

	/**
	 * Gets the argument type to use from an ID
	 * @param {CommandoClient} client - Client to use the registry of
	 * @param {string} id - ID of the type to use
	 * @returns {?ArgumentType}
	 * @private
	 */
	static determineType(client, id) {
		if (!id) return null;
		if (!id.includes("|")) return client.registry.types.get(id);

		let type = client.registry.types.get(id);
		if (type) return type;
		type = new ArgumentUnionType(client, id);
		client.registry.registerType(type);
		return type;
	}
}

module.exports = Argument;
