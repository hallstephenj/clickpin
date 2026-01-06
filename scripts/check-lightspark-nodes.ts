// Script to check available Lightspark nodes
// Run with: npx tsx scripts/check-lightspark-nodes.ts

import {
  LightsparkClient,
  AccountTokenAuthProvider,
} from '@lightsparkdev/lightspark-sdk';

async function main() {
  const clientId = process.env.LIGHTSPARK_API_TOKEN_CLIENT_ID;
  const clientSecret = process.env.LIGHTSPARK_API_TOKEN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing LIGHTSPARK_API_TOKEN_CLIENT_ID or LIGHTSPARK_API_TOKEN_CLIENT_SECRET');
    process.exit(1);
  }

  const authProvider = new AccountTokenAuthProvider(clientId, clientSecret);
  const client = new LightsparkClient(authProvider);

  const account = await client.getCurrentAccount();
  if (!account) {
    console.error('Failed to get account');
    process.exit(1);
  }

  console.log('Account:', account.id);

  // Get all nodes (no network filter)
  const nodesConnection = await account.getNodes(client, 10);

  console.log('\nAvailable nodes:');
  if (nodesConnection.entities) {
    for (const node of nodesConnection.entities) {
      console.log(`  - ${node.id}`);
      console.log(`    Display name: ${node.displayName}`);
      console.log(`    Status: ${node.status}`);
      console.log(`    Network: ${node.bitcoinNetwork}`);
      console.log('');
    }
  }

  if (!nodesConnection.entities || nodesConnection.entities.length === 0) {
    console.log('No nodes found');
  } else if (nodesConnection.entities.length === 1) {
    console.log('\n⚠️  You only have 1 node. To simulate payments in Lightspark test mode,');
    console.log('   you need 2 nodes (one to create invoice, one to pay it).');
    console.log('   Create another test node in your Lightspark dashboard.');
  } else {
    console.log(`\n✓ You have ${nodesConnection.entities.length} nodes available for test payments.`);
  }
}

main().catch(console.error);
