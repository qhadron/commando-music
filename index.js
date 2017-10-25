const path = require('path');
const fs = require('fs');

const COMMAND_PATH = path.resolve(__dirname, 'commands');

let config = require('./config');

function register(client, options) {
	options = Object.assign(config, options);
	config.client = client;
	if (client.registry.groups.has(options.group)) {
		throw new TypeError(`The client alrady has a group called ${options.group}`);
	}

	client.registry
		.registerGroups([[options.group, options.groupDescription]])
		.registerCommands(
			fs.readdirSync(COMMAND_PATH).map(file => require(path.resolve(COMMAND_PATH, file)))
		);
}

module.exports = register;
