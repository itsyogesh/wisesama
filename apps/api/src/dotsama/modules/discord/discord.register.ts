/**
 * One-time script to register slash commands with Discord.
 *
 * Usage:
 *   dotenv -e .env.local -- tsx src/modules/discord/discord.register.ts
 *
 * Required env vars: DISCORD_APP_ID, DISCORD_BOT_TOKEN
 */

const DISCORD_API = 'https://discord.com/api/v10';

const commands = [
  {
    name: 'check',
    description: 'Check a wallet address, domain, or Twitter handle for fraud risk',
    options: [
      {
        name: 'entity',
        description: 'Wallet address, domain, or Twitter handle to check',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'report',
    description: 'Report a suspicious entity',
    options: [
      {
        name: 'entity',
        description: 'Wallet address, domain, or handle to report',
        type: 3,
        required: true,
      },
      {
        name: 'category',
        description: 'Type of threat',
        type: 3,
        required: true,
        choices: [
          { name: 'Phishing', value: 'phishing' },
          { name: 'Scam', value: 'scam' },
          { name: 'Rug Pull', value: 'rug_pull' },
          { name: 'Impersonation', value: 'impersonation' },
          { name: 'Fake Airdrop', value: 'fake_airdrop' },
          { name: 'Ransomware', value: 'ransomware' },
          { name: 'Other', value: 'other' },
        ],
      },
      {
        name: 'description',
        description: 'Additional details about the threat',
        type: 3,
        required: false,
      },
    ],
  },
  {
    name: 'help',
    description: 'Learn how to use Wisesama bot',
  },
];

async function registerCommands() {
  const appId = process.env.DISCORD_APP_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!appId || !botToken) {
    console.error('Missing DISCORD_APP_ID or DISCORD_BOT_TOKEN');
    process.exit(1);
  }

  const url = `${DISCORD_API}/applications/${appId}/commands`;

  console.log(`Registering ${commands.length} commands for app ${appId}...`);

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to register commands:', response.status, error);
    process.exit(1);
  }

  const result = await response.json();
  console.log(`Successfully registered ${(result as unknown[]).length} commands:`);
  for (const cmd of result as Array<{ name: string; id: string }>) {
    console.log(`  /${cmd.name} (${cmd.id})`);
  }
}

registerCommands();
