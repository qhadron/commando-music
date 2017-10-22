const path = require('path');

function register(client, options) {
	options = Object.assign(
		{
			group: 'music',
			groupDescription: 'Music commands'
		},
		options
	);
	if (client.registry.groups.has(options.group)) {
		throw new TypeError(
			`The client alrady has a group called ${options.group}`
		);
	}
	client.registry
		.registerGroups([[options.group, options.groupDescription]])
		.registerCommandsIn(path.join(__dirname, 'commands'));
}

module.exports = {
	register
};
