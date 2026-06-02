require('dotenv').config();
const fs = require('fs');
const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    Routes,
    REST
} = require('discord.js');

const configPath = './config.json';

// ---------- CONFIG ----------
function loadConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({
            channelId: "",
            intervalSeconds: 60
        }, null, 2));
    }

    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function saveConfig(cfg) {
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
}

// ---------- CLIENT ----------
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ---------- CLEAN FUNCTION ----------
async function clearChannel() {
    const config = loadConfig();

    if (!config.channelId) {
        console.log("⚠️ No channel set");
        return;
    }

    try {
        const channel = await client.channels.fetch(config.channelId);

        if (!channel) {
            console.log("❌ Channel not found");
            return;
        }

        const messages = await channel.messages.fetch({ limit: 100 });

        const deletable = messages.filter(
            m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000
        );

        if (deletable.size > 0) {
            await channel.bulkDelete(deletable, true);
            console.log(`🧹 Deleted ${deletable.size} messages`);
        } else {
            console.log("ℹ️ Nothing to delete");
        }

    } catch (err) {
        console.error("❌ Cleanup error:", err);
    }
}

// ---------- TIMER (FIXED) ----------
function startScheduler() {
    const run = async () => {
        const config = loadConfig();

        if (!config.channelId || !config.intervalSeconds) {
            console.log("⚠️ Scheduler waiting for config...");
            setTimeout(run, 5000);
            return;
        }

        console.log(`⏱ Next cleanup in ${config.intervalSeconds}s`);

        setTimeout(async () => {
            console.log("🔥 Running cleanup...");
            await clearChannel();
            run(); // loop
        }, config.intervalSeconds * 1000);
    };

    run();
}

// ---------- SLASH COMMAND ----------
async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('settings')
            .setDescription('Bot settings')
            .addChannelOption(opt =>
                opt.setName('channel')
                    .setDescription('Channel to clean')
                    .setRequired(false)
            )
            .addIntegerOption(opt =>
                opt.setName('interval')
                    .setDescription('Interval in seconds')
                    .setRequired(false)
            )
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
    );

    console.log("✅ Slash commands registered");
}

// ---------- READY ----------
client.once('clientReady', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);

    await registerCommands();

    await clearChannel();

    startScheduler();
});

// ---------- INTERACTIONS ----------
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'settings') {
        const channel = interaction.options.getChannel('channel');
        const interval = interaction.options.getInteger('interval');

        const config = loadConfig();

        if (channel) config.channelId = channel.id;
        if (interval) config.intervalSeconds = interval;

        saveConfig(config);

        await interaction.reply({
            content: `✅ Updated:\nChannel: ${config.channelId || 'not set'}\nInterval: ${config.intervalSeconds}s`,
            flags: 64 // ephemeral (new Discord.js way)
        });

        console.log("⚙️ Config updated:", config);
    }
});

// ---------- LOGIN ----------
client.login(process.env.TOKEN);