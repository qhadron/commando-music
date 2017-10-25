/* eslint-env node, mocha */
const { expect } = require('chai');

const Commando = require('discord.js-commando');

const Music = require('../index');

describe('Commando', function() {
	describe('#register', function() {
		it(`should register a group called 'music' without error`, function() {
			const client = new Commando.Client();
			Music.register(client);
			expect(client.registry.groups.has('music')).to.be.true;
		});
		it(`should register a group called 'rock and roll' without error`, function() {
			const client = new Commando.Client();
			const groupName = 'rock and roll';
			Music.register(client, { group: groupName });
			expect(client.registry.groups.has('rock and roll')).to.be.true;
		});
		it("should error when there's already a music command group", function() {
			const client = new Commando.Client();
			client.registry.registerGroups([['music', 'music commands']]);
			expect(() => Music.register(client)).to.throw(/group/);
		});
	});
});
