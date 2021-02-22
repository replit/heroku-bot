// Create a .env and add your heroku token, app, and your github repo
const Heroku = require("heroku-client");
const Database = require("@replit/database");
const db = new Database();

// Use the email address associated with your Github account.
// The Slack ID can be found in your Full Profile > More menu.
const people = [
    {
        email: "arnav@repl.it",
        slack: "U012YNM8AUQ",
        github: "lunaroyster"
    },
    {
        email: "haya@repl.it",
        slack: "U03UBU93V",
        github: ""
    },
    {
        email: "moudy.elkammash@gmail.com",
        slack: "U8A5NA3B2",
        github: "moudy"
    },
    {
        email: "wade@repl.it",
        slack: "UV9TEDFSP",
        github: "AllAwesome497"
    },
    {
        email: "wadeabourne@gmail.com",
        slack: "UV9TEDFSP",
        github: "AllAwesome497"
    },
    {
        email: "amjad.masad@gmail.com",
        slack: "U03UB4UHB",
        github: "amasad"
    },
    {
        email: "amjad@repl.it",
        slack: "U03UB4UHB",
        github: "amasad"
    },
    {
        email: "dan@repl.it",
        slack: "UUGCAU5NF",
        github: "dan-stowell"
    },
    {
        email: "faris@repl.it",
        slack: "U80CXJQDC",
        github: ""
    },
    {
        email: "faris+oceanside@repl.it",
        slack: "U80CXJQDC",
        github: ""
    },
    {
        email: "jeremy@repl.it",
        slack: "UM5MAV9L2",
        github: ""
    },
    {
        email: "mason+1@repl.it",
        slack: "U39MWQBLJ",
        github: ""
    },
    {
        email: "moudy@repl.it",
        slack: "U8A5NA3B2",
        github: ""
    },
    {
        email: "sergei@repl.it",
        slack: "U01311T6P6F",
        github: ""
    },
    {
        email: "sidney@repl.it",
        slack: "UKPKM3HNY",
        github: ""
    },
    {
        email: "tyler@repl.it",
        slack: "UPY73PXK8",
        github: ""
    },
    {
        email: "zach@repl.it",
        slack: "U018WE29R33",
        github: "zabot"
    },
    {
        email: "connor@repl.it",
        slack: "U01A35UDSTA",
        github: "cbrewster"
    },
    {
      email: "luis@repl.it",
      slack: "U01BR4ERE9Y",
      github: "lhchavez"
    },
    {
      email: "derrick@repl.it",
      slack: "U01DLFUB57H",
      github: "demc"
    },
    {
      email: "o.albaroudi96@gmail.com",
      slack: "U016KFJDBCM",
      github: "Obaida-Albaroudi"
    },
    {
      email: "patrickscoleman@gmail.com",
      slack: "U012KPQKZST",
      github: "patrickscoleman"
    },
    {
      email: "alisa@repl.it",
      slack: "U01J7EUK4TZ",
      github: "chanalisa"
    },
    {
      email: "tiga@repl.it",
      slack: "U01EF7760SE",
      github: "slmjkdbtl"
    }
];
const token = process.env.HEROKU_TOKEN;
const heroku = new Heroku({ token });

const repoUrl = process.env.REPO_URL;
// Get a diff url with commmits between the latest deploy
// and staging app (or github master)
async function commits(toMaster) {
    const frm = (await getLatestRelease(process.env.APP)).commit;
    const toc = toMaster
        ? "master"
        : (await getLatestRelease(process.env.STAGING_APP)).commit;

    return `${repoUrl}/compare/${frm}...${toc}`;
}

async function getLatestRelease(appName) {
    const releases = await heroku.get(`/apps/${appName}/releases`);
    let latest = findLatest(releases);

    const matches = /Deploy\s(.*)/.exec(latest.description);
    if (!matches || !matches[1]) {
        throw new Error('Expected release to be in form of Deploy <hash>');
    }

    let commit = matches[1];
    let email = latest.user.email;
    return { commit, email };
}

// Traceback all rollbacks to get to the actual commit
function findLatest(releases, includeFailed = false) {
    let latest = releases[releases.length - 1];

    top: while (true) {
        if (latest.description.match(/rollback/i)) {
            const version = latest.description.split('Rollback to ')[1];
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
            latest.description.match(/^Enable/) ||
            latest.description.match(/completed provisioning/) ||
            (latest.status === "failed" && !includeFailed)
        ) {
            latest = releases[releases.indexOf(latest) - 1];
            continue;
        }
        break;
    }

    return latest;
}

// Server
const app = require("express")();
const bodyParser = require("body-parser");
const fetch = require("node-fetch");

function sendResponse(responseUrl, message) {
    return fetch(responseUrl, {
        method: "post",
        body: JSON.stringify(message),
        header: { "Content-Type": "application/json" },
    });
}

app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);

app.get("/check", async (req, res) => {
    await checkUndeployed();

    res.send("checked pending");
});

app.get("/", (req, res) => {
    commits().then((url) => res.send(`<a href=${url}>${url}</a>`));
});

app.post("/staging_deploy", async (req, res) => {
  console.log("got a deploy on staging", req.body);

  // app, user, url, head, head_long, git_log and release

  res.end("gotcha");

  return;
});

app.post("*", async (req, res) => {
    const userId = req.body.user_id;
    const responseUrl = req.body.response_url;

    if (
        req.body.text === "ok" ||
        req.body.text === "shutup" ||
        req.body.text.includes("chill")
    ) {
        const staging = await getLatestRelease(process.env.STAGING_APP);
        db.set(staging.commit, true);

        res.json({
            text:
                "Cool. This means you checked the changes on staging and they looked fine. Otherwise, you can revert those commits. Always keep master deployable!",
            response_type: "in_channel",
        });

        return;
    }

    res.json({
        text: "Fetching commits, please wait",
        response_type: "ephemeral",
    });

    const toMaster = req.body.text === "master";

    try {
        const diffUrl = await commits(toMaster);
        sendResponse(responseUrl, {
            response_type: "in_channel",
            text: `<@${userId}> here is the diff production...${
                toMaster ? "master" : "staging"
                }
	${diffUrl}`,
            mrkdwn: true,
        });
    } catch (e) {
        console.error(e);
        sendResponse(responseUrl, {
            response_type: "in_channel",
            text: "Failed to get commits :(",
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

    await db.set(staging.commit, false);

    const prod = await getLatestRelease(process.env.APP);


    if (prod.commit === staging.commit) return;

    let mention = getSlackIdByEmail(staging.email) || staging.email;



    await sendResponse(process.env.SLACK_HOOK, {
        text: `yo <@${mention}> i got commits ${repoUrl}/compare/${prod.commit}...${staging.commit}`,
    });

    const isReleaseTested = await db.get(`smoke_tests-${staging.commit}`);
    if (isReleaseTested) {
        return;
    }

    let walrusId;
    try {
        const response = await fetch('https://smoketest.util.repl.co/api/run', { method: 'POST' })
        const json = await response.json();
        walrusId = json.id
        await db.set(`smoke_tests-${staging.commit}`, true)
    } catch (e) {
        console.error('Walrus test failed to run');
        console.error(e)
    }

    if (walrusId) {
    await sendResponse(process.env.SLACK_HOOK, {
        text: `Smoke tests have been started with an ID of ${walrusId}. You can check their status with '/smoketest status'.`,
    });
    } else {
            await sendResponse(process.env.SLACK_HOOK, {
        text: "Smoke tests failed to start, please run them manually with '/smoketest run'",
    });
    }


}

const failedKey = (release) => "release-failure-" + release.id;
async function notifyFailedRelease() {
    const releases = await heroku.get(
        `/apps/${process.env.STAGING_APP}/releases`
    );
    const includeFailed = true;
    const latestRelease = await findLatest(releases, includeFailed);

    if (latestRelease.status !== "failed") {
        return;
    }

    if (await db.get(failedKey(latestRelease))) {
        return;
    }

    await db.set(failedKey(latestRelease), true);

    const url = `https://dashboard.heroku.com/apps/${process.env.STAGING_APP}/activity/releases/${latestRelease.id}`;

    await sendResponse(process.env.SLACK_HOOK, {
        text: `❌⚠️ Staging build failed ⚠️❌ ${url}`,
    });

    await db.set(failedKey(latestRelease), true);
}
app.listen(3000, () => console.log("server started"));

// setting this to run on a faster interval
setInterval(checkUndeployed, 60 * 10 * 1000);
setInterval(notifyFailedRelease, 60 * 10 * 1000);
