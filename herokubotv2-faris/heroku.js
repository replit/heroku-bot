const Heroku = require('heroku-client');
const slack = require('./slack');
const db = require('../replit-db');

const token = process.env.HEROKU_TOKEN;
const prodAppName = process.env.APP;
const stagingAppName = process.env.STAGING_APP;
const repoUrl = process.env.REPO_URL;

const herokuClient = new Heroku({ token });

// Gets a diff url
function diffUrl(frm, to) {
  return `${repoUrl}/compare/${frm}...${toc}`;
}

// Gets a diff url between production and staging
async function diffStaging() {
  const { commit: frm } = await getLatestCommitAndEmail(prodAppName);
  const { commit: to } = await getLatestCommitAndEmail(stagingAppName);

  return diffUrl(frm, toc);
}

// Gets a diff url between production and master
async function diffMaster() {
  const { commit: frm } = await getLatestCommitAndEmail(prodAppName);
  const to = 'master';

  return diffUrl(frm, to);
}

// Fetches releases and finds the commit and the email of the committer
async function getLatestCommitAndEmail(appName) {
  const releases = await herokuClient.get(`/apps/${appName}/releases`);
  let latest = findLatestGitRelease(releases);

  let commit = latest.description.split(/\s/)[1];
  let email = latest.user.email;
  return { commit, email };
}

// Traceback all rollbacks to get to the actual git change
function findLatestGitRelease(releases, includeFailed = false) {
  let latest = releases[releases.length - 1];

  top: while (true) {
    if (latest.description.match(/rollback/i)) {
      const version = latest.description.split(/\s/)[2];
      const num = parseInt(version.slice(1));
      for (const rel of releases) {
        if (rel.version === num) {
          latest = rel;
          continue top;
        }
      }
    }

    // Actions to be ignored
    if (
      latest.description.match(/^Update/i) ||
      latest.description.match(/config vars/) ||
      latest.description.match(/^Detach/) ||
      latest.description.match(/^Attach/) ||
      latest.description.match(/completed provisioning/) ||
      (latest.status === 'failed' && !includeFailed)
    ) {
      latest = releases[releases.indexOf(latest) - 1];
      continue;
    }
    break;
  }

  return latest;
}

async function notifyUndeployed() {
	const staging = await getLatestRelease(stagingAppName);

	const acknolwedgeKey = db.keys.getAcknowledgeKey(stagin.commit);

	if (await db.get(acknolwedgeKey)) {
		// User acknolwedged the diff, and doesn't want to deploy
		return;
	}

	await db.set(acknolwedgeKey, false);

	const prod = await getLatestRelease(process.env.APP);

	if (prod.commit === staging.commit) {
		return;
	}

	const mention = slack.getSlackIdByEmail(staging.email) || staging.email;

	await slack.sendMessage({
		text: `yo <@${mention}> i got commits ${diffUrl(
			prod.commit,
			staging.commit,
		)}`,
	});
}

function startTimers() {
  // Every 10 minutes checks for a undeployed releases on staging
  // and pings a person on slack
  setInterval(notifyUndeployed, 60 * 10 * 1000);

  // Every 10 minutes checks for a new failed latest release
  // and sends a message to the channel.
  setInterval(async () => {
    const releases = await herokuClient.get(`/apps/${stagingAppName}/releases`);
    const includeFailed = true;
    const latestRelease = await findLatest(releases, includeFailed);

    if (latestRelease.status !== 'failed') {
      return;
    }

    const failedKey = db.keys.getFailureKey(latestRelease);
    if (await db.get(failedKey)) {
      // We already notified the channel
      return;
    }

    await db.set(failedKey, true);

    const url = `https://dashboard.heroku.com/apps/${stagingAppName}/activity/releases/${latestRelease.id}`;

    await slack.sendMessage({
      text: `❌⚠️ Staging build failed ⚠️❌ ${url}`,
    });

    await db.set(failedKey, true);
  }, 60 * 10 * 1000);
}

// Acknolwedge the latest staging commit so that the notifier
// doesn't keep @ on the channel
async function acknowledgeUnpromoted() {
  const { commit } = await herokuClient.getLatestCommitAndEmail(stagingAppName);
  db.set(db.keys.getAcknowledgeKey(commit), true);
}

module.exports = {
  diffStaging,
  diffMaster,
  acknowledgeUnpromoted,
  startNotifiers,
	notifyUndeployed,
};
