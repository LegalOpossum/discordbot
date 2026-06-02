require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

async function clearChannel() {
    try {
        const channel = await client.channels.fetch(process.env.CHANNEL_ID);

        const messages = await channel.messages.fetch({ limit: 100 });

        const deletable = messages.filter(
            m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000
        );

        if (deletable.size > 0) {
            await channel.bulkDelete(deletable, true);
        }

        console.log("Channel cleaned:", new Date());
    } catch (err) {
        console.error(err);
    }
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);

    clearChannel();

    setInterval(
        clearChannel,
        Number(process.env.INTERVAL_HOURS) * 60 * 60 * 1000
    );
});

client.login(process.env.TOKEN);
