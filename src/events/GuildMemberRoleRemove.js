module.exports = (client) => {
	client.on("guildMemberUpdate", (oldMember, newMember) => {
		if (oldMember.roles.cache.size > newMember.roles.cache.size) {
			for (const role of oldMember.roles.cache.array()) {
				if (!newMember.roles.cache.has(role.id)) {
					client.emit("guildMemberRoleRemove", newMember, role);
				}
			}
		}
	});
};
