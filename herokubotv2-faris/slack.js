const fetch = require('node-fetch');
const db = require('../replit-db');
const heroku = require('./heroku');

const people = [
  {
    email: 'arnav@repl.it',
    slack: 'U012YNM8AUQ',
    github: 'lunaroyster',
  },
  {
    email: 'haya@repl.it',
    slack: 'U03UBU93V',
    github: '',
  },
  {
    email: 'moudy.elkammash@gmail.com',
    slack: 'U8A5NA3B2',
    github: 'moudy',
  },
  {
    email: 'parvathi@repl.it',
    slack: 'U012503NQJU',
    github: '',
  },
  {
    email: 'alan@repl.it',
    slack: 'U010Z00ULUC',
    github: 'ALANVF',
  },
  {
    email: 'theangryepicbanana@gmail.com',
    slack: 'U010Z00ULUC',
    github: 'ALANVF',
  },
  {
    email: 'wade@repl.it',
    slack: 'UV9TEDFSP',
    github: 'AllAwesome497',
  },
  {
    email: 'wadeabourne@gmail.com',
    slack: 'UV9TEDFSP',
    github: 'AllAwesome497',
  },
  {
    email: 'amjad.masad@gmail.com',
    slack: 'U03UB4UHB',
    github: 'amasad',
  },
  {
    email: 'amjad@repl.it',
    slack: 'U03UB4UHB',
    github: 'amasad',
  },
  {
    email: 'dan@repl.it',
    slack: 'UUGCAU5NF',
    github: 'dan-stowell',
  },
  {
    email: 'emily@repl.it',
    slack: 'U010A6L6TKL',
    github: '',
  },
  {
    email: 'faris@repl.it',
    slack: 'U80CXJQDC',
    github: '',
  },
  {
    email: 'jeremy@repl.it',
    slack: 'UM5MAV9L2',
    github: '',
  },
  {
    email: 'mason+1@repl.it',
    slack: 'U39MWQBLJ',
    github: '',
  },
  {
    email: 'moudy@repl.it',
    slack: 'U8A5NA3B2',
    github: '',
  },
  {
    email: 'sergei@repl.it',
    slack: 'U01311T6P6F',
    github: '',
  },
  {
    email: 'sidney@repl.it',
    slack: 'UKPKM3HNY',
    github: '',
  },
  {
    email: 'tyler@repl.it',
    slack: 'UPY73PXK8',
    github: '',
  },
];

const slackHookUrl = process.env.SLACK_HOOK;
function sendMessage(message, sendUrl = slackHookUrl) {
  return fetch(sendUrl, {
    method: 'post',
    body: JSON.stringify(message),
    header: { 'Content-Type': 'application/json' },
  });
}

function getSlackIdByEmail(email) {
  for (let person of people) {
    if (person.email === email && person.slack) {
      return person.slack;
    }
  }
}

async function slashCommits(req, res) {
  const userId = req.body.user_id;
  const responseUrl = req.body.response_url;
  const slashArg = req.body.text;

  if (
    slashArg === 'ok' ||
    slashArg === 'shutup' ||
    slashArg.includes('chill')
  ) {
    res.json({
      text:
        'Cool. This means you checked the changes on staging and they looked fine. Otherwise, you can revert those commits. Always keep master deployable!',
      response_type: 'in_channel',
    });

		await heroku.acknowledgeUnpromoted();

    return;
  }

  // respond early, otherwise command will timeout
  res.json({
    text: 'Fetching commits, please wait',
    response_type: 'ephemeral',
  });

  const toMaster = slashArg === 'master';
  const diffFn = toMaster ? heroku.diffMaster : heroku.diffStaging;
	const diffTo = toMaster ? 'master' : 'staging';
  try {
    const diffUrl = await diffFn();
    sendMessage({
      response_type: 'in_channel',
      text: `<@${userId}> here is the diff production...${diffTo}
${diffUrl}`,
      mrkdwn: true,
    }, responseUrl);
  } catch (e) {
    console.error(e);
    sendMessage({
      response_type: 'in_channel',
      text: 'Failed to get commits :(',
      mrkdwn: true,
    }, responseUrl);
  }
}

module.exports = {
  sendMessage,
  getSlackIdByEmail,
	slashCommits,
};
