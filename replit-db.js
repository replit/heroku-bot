
// set: curl $REPLIT_KV_URL -d '<key>=<value>'
// get: curl $REPLIT_KV_URL/<key>
// delete: curl -XDELETE $REPLIT_KV_URL/<key>
// list: curl $REPLIT_KV_URL --get -d 'prefix=<key>
// or curl "$REPLIT_KV_URL?prefix=<key>"

// console.log(process.env.REPLIT_KV_URL)
const fetch = require('node-fetch');

module.exports = {
  set: (key, value) =>
    fetch(process.env.REPLIT_KV_URL, {
      method: 'POST',
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `${key}=${JSON.stringify(value)}`
    })
      .then(r => r.ok),
  get: (key) => fetch(`${process.env.REPLIT_KV_URL}/${key}`)
    .then(r => r.text())
    .then(strValue => {
      if (!strValue) {
        return null;
      }

      let value = strValue;
      try {
        value = JSON.parse(strValue);
      } catch (err) {} // eslint-disable-line


      if (value === null || value === undefined) {
        return null;
      }

      return value;
    }),
  delete: () => { throw new Error('unimplemented') },
  list: () => { throw new Error('unimplemented') },
}