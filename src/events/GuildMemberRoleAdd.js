module.exports = (client) => {
	client.on("guildMemberUpdate", (oldMember, newMember) => {
		if (oldMember.roles.cache.size < newMember.roles.cache.size) {
			for (const role of newMember.roles.cache.array()) {
				if (!oldMember.roles.cache.has(role.id)) {
					client.emit("guildMemberRoleAdd", newMember, role);
				}
			}
		}
	});
};
