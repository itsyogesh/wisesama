import { PrismaClient } from '@prisma/client';
import { decodeAddress } from '@polkadot/util-crypto';
import { u8aToHex } from '@polkadot/util';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Normalize entity value based on type (matching apps/api/src/utils/normalize.ts)
function normalizeEntityValue(
  value: string,
  entityType: 'ADDRESS' | 'DOMAIN' | 'TWITTER' | 'EMAIL'
): string {
  switch (entityType) {
    case 'ADDRESS':
      return u8aToHex(decodeAddress(value));
    case 'TWITTER':
      return value.toLowerCase().replace(/^@/, '');
    case 'DOMAIN':
      return value
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0] ?? '';
    case 'EMAIL':
      return value.toLowerCase();
    default:
      return value.toLowerCase();
  }
}

const chains = [
  {
    code: 'dot',
    name: 'Polkadot',
    ss58Prefix: 0,
    rpcEndpoint: 'wss://rpc.polkadot.io',
    explorerUrl: 'https://polkadot.subscan.io',
  },
  {
    code: 'ksm',
    name: 'Kusama',
    ss58Prefix: 2,
    rpcEndpoint: 'wss://kusama-rpc.polkadot.io',
    explorerUrl: 'https://kusama.subscan.io',
  },
  {
    code: 'astr',
    name: 'Astar',
    ss58Prefix: 5,
    rpcEndpoint: 'wss://rpc.astar.network',
    explorerUrl: 'https://astar.subscan.io',
  },
  {
    code: 'glmr',
    name: 'Moonbeam',
    ss58Prefix: 1284,
    rpcEndpoint: 'wss://wss.api.moonbeam.network',
    explorerUrl: 'https://moonbeam.subscan.io',
  },
  {
    code: 'movr',
    name: 'Moonriver',
    ss58Prefix: 1285,
    rpcEndpoint: 'wss://wss.api.moonriver.moonbeam.network',
    explorerUrl: 'https://moonriver.subscan.io',
  },
  {
    code: 'aca',
    name: 'Acala',
    ss58Prefix: 10,
    rpcEndpoint: 'wss://acala-rpc.dwellir.com',
    explorerUrl: 'https://acala.subscan.io',
  },
  {
    code: 'kar',
    name: 'Karura',
    ss58Prefix: 8,
    rpcEndpoint: 'wss://karura-rpc.dwellir.com',
    explorerUrl: 'https://karura.subscan.io',
  },
  {
    code: 'hdx',
    name: 'HydraDX',
    ss58Prefix: 63,
    rpcEndpoint: 'wss://rpc.hydradx.cloud',
    explorerUrl: 'https://hydradx.subscan.io',
  },
];

// Initial whitelist of known ecosystem entities
const whitelistedEntities = [
  // Polkadot Treasury
  {
    entityType: 'ADDRESS' as const,
    value: '13UVJyLnbVp9RBZYFwFGyDvVd1y27Tt8tkntv6Q7JVPhFsTB',
    name: 'Polkadot Treasury',
    category: 'treasury',
    description: 'Official Polkadot Treasury account',
    website: 'https://polkadot.network',
    twitter: 'Polkadot',
    source: 'manual',
    chainCode: 'dot',
  },
  // Kusama Treasury
  {
    entityType: 'ADDRESS' as const,
    value: 'F3opxRbN5ZbjJNU511Kj2TLuzFcDq9BGduA9TgiECafpg29',
    name: 'Kusama Treasury',
    category: 'treasury',
    description: 'Official Kusama Treasury account',
    website: 'https://kusama.network',
    twitter: 'kuaborasmnet',
    source: 'manual',
    chainCode: 'ksm',
  },
  // Web3 Foundation
  {
    entityType: 'DOMAIN' as const,
    value: 'web3.foundation',
    name: 'Web3 Foundation',
    category: 'project',
    description: 'Web3 Foundation official website',
    website: 'https://web3.foundation',
    twitter: 'Web3foundation',
    source: 'manual',
  },
  // Parity Technologies
  {
    entityType: 'DOMAIN' as const,
    value: 'parity.io',
    name: 'Parity Technologies',
    category: 'project',
    description: 'Parity Technologies - core Polkadot developers',
    website: 'https://parity.io',
    twitter: 'ParityTech',
    source: 'manual',
  },
  // Polkadot official
  {
    entityType: 'DOMAIN' as const,
    value: 'polkadot.network',
    name: 'Polkadot Network',
    category: 'project',
    description: 'Official Polkadot website',
    website: 'https://polkadot.network',
    twitter: 'Polkadot',
    source: 'manual',
  },
  {
    entityType: 'TWITTER' as const,
    value: 'Polkadot',
    name: 'Polkadot',
    category: 'project',
    description: 'Official Polkadot Twitter account',
    website: 'https://polkadot.network',
    twitter: 'Polkadot',
    source: 'manual',
  },
  {
    entityType: 'TWITTER' as const,
    value: 'gavofyork',
    name: 'Gavin Wood',
    category: 'founder',
    description: 'Polkadot founder and Parity co-founder',
    website: 'https://gavwood.com',
    twitter: 'gavofyork',
    source: 'manual',
  },
  {
    entityType: 'TWITTER' as const,
    value: 'AcalaNetwork',
    name: 'Acala Network',
    category: 'project',
    description: 'DeFi hub of Polkadot',
    website: 'https://acala.network',
    twitter: 'AcalaNetwork',
    source: 'manual',
  },
  {
    entityType: 'TWITTER' as const,
    value: 'AstarNetwork',
    name: 'Astar Network',
    category: 'project',
    description: 'Smart contract platform on Polkadot',
    website: 'https://astar.network',
    twitter: 'AstarNetwork',
    source: 'manual',
  },
  {
    entityType: 'TWITTER' as const,
    value: 'MoonbeamNetwork',
    name: 'Moonbeam Network',
    category: 'project',
    description: 'Ethereum-compatible smart contract parachain',
    website: 'https://moonbeam.network',
    twitter: 'MoonbeamNetwork',
    source: 'manual',
  },
  // Major exchanges
  {
    entityType: 'DOMAIN' as const,
    value: 'kraken.com',
    name: 'Kraken',
    category: 'exchange',
    description: 'Kraken cryptocurrency exchange',
    website: 'https://kraken.com',
    twitter: 'kraken',
    source: 'manual',
  },
  {
    entityType: 'DOMAIN' as const,
    value: 'binance.com',
    name: 'Binance',
    category: 'exchange',
    description: 'Binance cryptocurrency exchange',
    website: 'https://binance.com',
    twitter: 'binance',
    source: 'manual',
  },

  // ========== NEW ENTITIES (Phase 3 Expansion) ==========

  // Key Ecosystem Figures
  {
    entityType: 'TWITTER' as const,
    value: 'shawntabrizi',
    name: 'Shawn Tabrizi',
    category: 'founder',
    description: 'Runtime Engineering Lead at Parity Technologies',
    website: 'https://shawntabrizi.com',
    twitter: 'shawntabrizi',
    source: 'manual',
  },
  {
    entityType: 'TWITTER' as const,
    value: 'paritytech',
    name: 'Parity Technologies',
    category: 'project',
    description: 'Core developers of Polkadot and Substrate',
    website: 'https://parity.io',
    twitter: 'paritytech',
    source: 'manual',
  },
  {
    entityType: 'TWITTER' as const,
    value: 'Web3foundation',
    name: 'Web3 Foundation',
    category: 'project',
    description: 'Non-profit funding Web3 development',
    website: 'https://web3.foundation',
    twitter: 'Web3foundation',
    source: 'manual',
  },

  // Parachains - Moonbeam
  {
    entityType: 'DOMAIN' as const,
    value: 'moonbeam.network',
    name: 'Moonbeam Network',
    category: 'parachain',
    description: 'Ethereum-compatible smart contract parachain',
    website: 'https://moonbeam.network',
    twitter: 'MoonbeamNetwork',
    source: 'manual',
  },

  // Parachains - Astar
  {
    entityType: 'DOMAIN' as const,
    value: 'astar.network',
    name: 'Astar Network',
    category: 'parachain',
    description: 'Smart contract platform supporting EVM and WASM',
    website: 'https://astar.network',
    twitter: 'AstarNetwork',
    source: 'manual',
  },

  // Parachains - Acala
  {
    entityType: 'DOMAIN' as const,
    value: 'acala.network',
    name: 'Acala Network',
    category: 'parachain',
    description: 'DeFi and liquidity hub of Polkadot',
    website: 'https://acala.network',
    twitter: 'AcalaNetwork',
    source: 'manual',
  },

  // Parachains - Phala
  {
    entityType: 'TWITTER' as const,
    value: 'PhalaNetwork',
    name: 'Phala Network',
    category: 'parachain',
    description: 'Privacy-preserving cloud computing on Polkadot',
    website: 'https://phala.network',
    twitter: 'PhalaNetwork',
    source: 'manual',
  },
  {
    entityType: 'DOMAIN' as const,
    value: 'phala.network',
    name: 'Phala Network',
    category: 'parachain',
    description: 'Privacy-preserving cloud computing on Polkadot',
    website: 'https://phala.network',
    twitter: 'PhalaNetwork',
    source: 'manual',
  },

  // Parachains - Bifrost
  {
    entityType: 'TWITTER' as const,
    value: 'BifrostFinance',
    name: 'Bifrost Finance',
    category: 'parachain',
    description: 'Liquid staking protocol on Polkadot',
    website: 'https://bifrost.finance',
    twitter: 'BifrostFinance',
    source: 'manual',
  },
  {
    entityType: 'DOMAIN' as const,
    value: 'bifrost.finance',
    name: 'Bifrost Finance',
    category: 'parachain',
    description: 'Liquid staking protocol on Polkadot',
    website: 'https://bifrost.finance',
    twitter: 'BifrostFinance',
    source: 'manual',
  },

  // Parachains - Centrifuge
  {
    entityType: 'TWITTER' as const,
    value: 'centrifuge',
    name: 'Centrifuge',
    category: 'parachain',
    description: 'Real-world asset financing on Polkadot',
    website: 'https://centrifuge.io',
    twitter: 'centrifuge',
    source: 'manual',
  },
  {
    entityType: 'DOMAIN' as const,
    value: 'centrifuge.io',
    name: 'Centrifuge',
    category: 'parachain',
    description: 'Real-world asset financing on Polkadot',
    website: 'https://centrifuge.io',
    twitter: 'centrifuge',
    source: 'manual',
  },

  // Parachains - Interlay
  {
    entityType: 'TWITTER' as const,
    value: 'InterlayHQ',
    name: 'Interlay',
    category: 'parachain',
    description: 'Decentralized Bitcoin on Polkadot',
    website: 'https://interlay.io',
    twitter: 'InterlayHQ',
    source: 'manual',
  },
  {
    entityType: 'DOMAIN' as const,
    value: 'interlay.io',
    name: 'Interlay',
    category: 'parachain',
    description: 'Decentralized Bitcoin on Polkadot',
    website: 'https://interlay.io',
    twitter: 'InterlayHQ',
    source: 'manual',
  },

  // Parachains - Parallel Finance
  {
    entityType: 'TWITTER' as const,
    value: 'ParallelFi',
    name: 'Parallel Finance',
    category: 'parachain',
    description: 'DeFi super app on Polkadot',
    website: 'https://parallel.fi',
    twitter: 'ParallelFi',
    source: 'manual',
  },
  {
    entityType: 'DOMAIN' as const,
    value: 'parallel.fi',
    name: 'Parallel Finance',
    category: 'parachain',
    description: 'DeFi super app on Polkadot',
    website: 'https://parallel.fi',
    twitter: 'ParallelFi',
    source: 'manual',
  },

  // Parachains - KILT Protocol
  {
    entityType: 'TWITTER' as const,
    value: 'Kiltprotocol',
    name: 'KILT Protocol',
    category: 'parachain',
    description: 'Decentralized identity solutions on Polkadot',
    website: 'https://kilt.io',
    twitter: 'Kiltprotocol',
    source: 'manual',
  },
  {
    entityType: 'DOMAIN' as const,
    value: 'kilt.io',
    name: 'KILT Protocol',
    category: 'parachain',
    description: 'Decentralized identity solutions on Polkadot',
    website: 'https://kilt.io',
    twitter: 'Kiltprotocol',
    source: 'manual',
  },

  // Parachains - Zeitgeist
  {
    entityType: 'TWITTER' as const,
    value: 'ZeitgeistPM',
    name: 'Zeitgeist',
    category: 'parachain',
    description: 'Prediction markets on Polkadot',
    website: 'https://zeitgeist.pm',
    twitter: 'ZeitgeistPM',
    source: 'manual',
  },
  {
    entityType: 'DOMAIN' as const,
    value: 'zeitgeist.pm',
    name: 'Zeitgeist',
    category: 'parachain',
    description: 'Prediction markets on Polkadot',
    website: 'https://zeitgeist.pm',
    twitter: 'ZeitgeistPM',
    source: 'manual',
  },

  // Parachains - Nodle
  {
    entityType: 'TWITTER' as const,
    value: 'NodleNetwork',
    name: 'Nodle Network',
    category: 'parachain',
    description: 'Decentralized IoT network on Polkadot',
    website: 'https://nodle.io',
    twitter: 'NodleNetwork',
    source: 'manual',
  },
  {
    entityType: 'DOMAIN' as const,
    value: 'nodle.io',
    name: 'Nodle Network',
    category: 'parachain',
    description: 'Decentralized IoT network on Polkadot',
    website: 'https://nodle.io',
    twitter: 'NodleNetwork',
    source: 'manual',
  },

  // Parachains - Hydration (HydraDX)
  {
    entityType: 'TWITTER' as const,
    value: 'hydaboradx',
    name: 'Hydration (HydraDX)',
    category: 'parachain',
    description: 'Omnipool DEX on Polkadot',
    website: 'https://hydration.net',
    twitter: 'hydaboradx',
    source: 'manual',
  },
  {
    entityType: 'DOMAIN' as const,
    value: 'hydration.net',
    name: 'Hydration (HydraDX)',
    category: 'parachain',
    description: 'Omnipool DEX on Polkadot',
    website: 'https://hydration.net',
    twitter: 'hydaboradx',
    source: 'manual',
  },
  {
    entityType: 'DOMAIN' as const,
    value: 'hydradx.io',
    name: 'Hydration (HydraDX)',
    category: 'parachain',
    description: 'Omnipool DEX on Polkadot',
    website: 'https://hydradx.io',
    twitter: 'hydaboradx',
    source: 'manual',
  },

  // Wallets - Talisman
  {
    entityType: 'TWITTER' as const,
    value: 'TalismanWallet',
    name: 'Talisman Wallet',
    category: 'wallet',
    description: 'Multi-chain wallet for Polkadot ecosystem',
    website: 'https://talisman.xyz',
    twitter: 'TalismanWallet',
    source: 'manual',
  },
  {
    entityType: 'DOMAIN' as const,
    value: 'talisman.xyz',
    name: 'Talisman Wallet',
    category: 'wallet',
    description: 'Multi-chain wallet for Polkadot ecosystem',
    website: 'https://talisman.xyz',
    twitter: 'TalismanWallet',
    source: 'manual',
  },

  // Wallets - Nova Wallet
  {
    entityType: 'TWITTER' as const,
    value: 'NovaWalletApp',
    name: 'Nova Wallet',
    category: 'wallet',
    description: 'Next-gen mobile wallet for Polkadot ecosystem',
    website: 'https://novawallet.io',
    twitter: 'NovaWalletApp',
    source: 'manual',
  },
  {
    entityType: 'DOMAIN' as const,
    value: 'novawallet.io',
    name: 'Nova Wallet',
    category: 'wallet',
    description: 'Next-gen mobile wallet for Polkadot ecosystem',
    website: 'https://novawallet.io',
    twitter: 'NovaWalletApp',
    source: 'manual',
  },

  // Wallets - SubWallet
  {
    entityType: 'TWITTER' as const,
    value: 'subwallet_app',
    name: 'SubWallet',
    category: 'wallet',
    description: 'Non-custodial Polkadot wallet',
    website: 'https://subwallet.app',
    twitter: 'subwallet_app',
    source: 'manual',
  },
  {
    entityType: 'DOMAIN' as const,
    value: 'subwallet.app',
    name: 'SubWallet',
    category: 'wallet',
    description: 'Non-custodial Polkadot wallet',
    website: 'https://subwallet.app',
    twitter: 'subwallet_app',
    source: 'manual',
  },

  // Infrastructure - Subscan
  {
    entityType: 'DOMAIN' as const,
    value: 'subscan.io',
    name: 'Subscan',
    category: 'infrastructure',
    description: 'Multi-chain explorer for Polkadot ecosystem',
    website: 'https://subscan.io',
    twitter: 'subscan_io',
    source: 'manual',
  },
  {
    entityType: 'TWITTER' as const,
    value: 'subscan_io',
    name: 'Subscan',
    category: 'infrastructure',
    description: 'Multi-chain explorer for Polkadot ecosystem',
    website: 'https://subscan.io',
    twitter: 'subscan_io',
    source: 'manual',
  },

  // Infrastructure - Polkadot.js
  {
    entityType: 'DOMAIN' as const,
    value: 'polkadot.js.org',
    name: 'Polkadot.js',
    category: 'infrastructure',
    description: 'Official Polkadot JavaScript tools and apps',
    website: 'https://polkadot.js.org',
    twitter: 'polkadotjs',
    source: 'manual',
  },

  // Additional official domains
  {
    entityType: 'DOMAIN' as const,
    value: 'polkadot.com',
    name: 'Polkadot',
    category: 'project',
    description: 'Official Polkadot website',
    website: 'https://polkadot.com',
    twitter: 'Polkadot',
    source: 'manual',
  },
  {
    entityType: 'DOMAIN' as const,
    value: 'kusama.network',
    name: 'Kusama Network',
    category: 'project',
    description: 'Official Kusama canary network website',
    website: 'https://kusama.network',
    twitter: 'kusamanetwork',
    source: 'manual',
  },
];

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminEmail = 'admin@wisesama.com';
  const adminPassword = 'admin123'; // Change in production!
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: 'ADMIN',
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      tier: 'ENTERPRISE',
      remainingQuota: 1000000,
    },
  });
  console.log(`  ✓ Admin user: ${adminEmail} (password: ${adminPassword})`);

  // Seed chains
  for (const chain of chains) {
    await prisma.chain.upsert({
      where: { code: chain.code },
      update: chain,
      create: chain,
    });
    console.log(`  ✓ Chain: ${chain.name}`);
  }

  // Seed whitelisted entities
  for (const entity of whitelistedEntities) {
    const chainId = entity.chainCode
      ? (await prisma.chain.findUnique({ where: { code: entity.chainCode } }))?.id
      : null;

    const normalizedValue = normalizeEntityValue(entity.value, entity.entityType);

    await prisma.whitelistedEntity.upsert({
      where: {
        entityType_normalizedValue: {
          entityType: entity.entityType,
          normalizedValue,
        },
      },
      update: {
        name: entity.name,
        category: entity.category,
        description: entity.description,
        website: entity.website,
        twitter: entity.twitter,
        source: entity.source,
        chainId,
      },
      create: {
        entityType: entity.entityType,
        value: entity.value,
        normalizedValue,
        name: entity.name,
        category: entity.category,
        description: entity.description,
        website: entity.website,
        twitter: entity.twitter,
        source: entity.source,
        chainId,
        verifiedAt: new Date(),
      },
    });
    console.log(`  ✓ Whitelist: ${entity.name}`);
  }

  // Create initial sync state for phishing list
  await prisma.syncState.upsert({
    where: { sourceName: 'polkadot-js-phishing' },
    update: {},
    create: {
      sourceName: 'polkadot-js-phishing',
      metadata: {
        addressUrl: 'https://polkadot.js.org/phishing/address.json',
        allUrl: 'https://polkadot.js.org/phishing/all.json',
      },
    },
  });
  console.log('  ✓ Sync state initialized');

  console.log('\nSeeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
