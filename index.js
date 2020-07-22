	// Create a .env and add your heroku token, app, and your github repo
const Heroku = require('heroku-client');
const people = require('./people');
const token = process.env.HEROKU_TOKEN;
const heroku = new Heroku({ token });
const db = require('./replit-db');


const repoUrl = process.env.REPO_URL;
// Get a diff url with commmits between the latest deploy
// and staging app (or github master)
async function commits(toMaster) {
	const frm = (await getLatestRelease(process.env.APP)).commit;
	const toc = toMaster
		? 'master'
		: (await getLatestRelease(process.env.STAGING_APP)).commit;

	return `${repoUrl}/compare/${frm}...${toc}`;
}

async function getLatestRelease(appName) {
	const releases = await heroku.get(`/apps/${appName}/releases`);
	let latest = findLatest(releases);

	let commit = latest.description.split(/\s/)[1];
	let email = latest.user.email;
	return { commit, email };
}

// Traceback all rollbacks to get to the actual commit
function findLatest(releases, includeFailed = false) {
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

// Server
const app = require('express')();
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

function sendResponse(responseUrl, message) {
	return fetch(responseUrl, {
		method: 'post',
		body: JSON.stringify(message),
		header: { 'Content-Type': 'application/json' },
	});
}

app.use(
	bodyParser.urlencoded({
		extended: true,
	}),
);


app.get('/check', async (req, res) => {
	await checkUndeployed();

	res.send('checked pending')
});

app.get('/', (req, res) => {
	commits().then((url) => res.send(`<a href=${url}>${url}</a>`));
});

app.post('/staging_deploy', async (req, res) => {
	console.log('got a deploy on staging', req.body);

	// app, user, url, head, head_long, git_log and release

	res.end('gotcha');

	return;
})

app.post('*', async (req, res) => {
	const userId = req.body.user_id;
	const responseUrl = req.body.response_url;

	if (req.body.text === 'ok' || req.body.text === 'shutup' || req.body.text.includes('chill')) {
		const staging = await getLatestRelease(process.env.STAGING_APP);
    db.set(staging.commit, true);

		res.json({
			text: "Cool. This means you checked the changes on staging and they looked fine. Otherwise, you can revert those commits. Always keep master deployable!",
			response_type: 'in_channel',
		});

		return;
	}

	res.json({
		text: 'Fetching commits, please wait',
		response_type: 'ephemeral',
	});

	const toMaster = req.body.text === 'master';

	try {
		const diffUrl = await commits(toMaster)
		sendResponse(responseUrl, {
			response_type: 'in_channel',
			text: `<@${userId}> here is the diff production...${
				toMaster ? 'master' : 'staging'
				}
	${diffUrl}`,
			mrkdwn: true,
		});
	} catch (e) {
		console.error(e);
		sendResponse(responseUrl, {
			response_type: 'in_channel',
			text: 'Failed to get commits :(',
			mrkdwn: true,
		});
	}
});

function getSlackIdByEmail(email) {
	for (let person of people) {
		if (person.email === email) {
			if (person.slack) return person.slack;
		}
	}
}



async function checkUndeployed() {
	const staging = await getLatestRelease(process.env.STAGING_APP);

	if (await db.get(staging.commit)) {
		return;
	}

  await db.set(staging.commit, false)

	const prod = await getLatestRelease(process.env.APP);

	if (prod.commit === staging.commit) return;

	let mention = getSlackIdByEmail(staging.email) || staging.email;

	await sendResponse(process.env.SLACK_HOOK, {
		text: `yo <@${mention}> i got commits ${repoUrl}/compare/${prod.commit}...${staging.commit}`,
	});
}

const failedKey = (release) => 'release-failure-' + release.id;
async function notifyFailedRelease() {
	const releases = await heroku.get(`/apps/${process.env.STAGING_APP}/releases`);
	const includeFailed = true;
	const latestRelease = await findLatest(releases, includeFailed)	

	if (latestRelease.status !== 'failed') {
		return;
	}

	if (await db.get(failedKey(latestRelease))) {
		return;
	}

	await db.set(failedKey(latestRelease), true)

	const url = `https://dashboard.heroku.com/apps/${process.env.STAGING_APP}/activity/releases/${latestRelease.id}`;

	await sendResponse(process.env.SLACK_HOOK, {
		text: `❌⚠️ Staging build failed ⚠️❌ ${url}`,
	});

	await db.set(failedKey(latestRelease), true)
}
app.listen(3000, () => console.log('server started'));

setInterval(checkUndeployed, 60 * 10 * 1000);
setInterval(notifyFailedRelease, 60 * 10 * 1000);