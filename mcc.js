#!/usr/bin/env node

const puppeteer = require('puppeteer');
const chalk = require('chalk');
const { URL } = require('url');
const fs = require('fs-extra');
const prompt = require('prompt-sync')();
const touch = require('touch');
const filenames = require('./filenames.json');

const argv = require('yargs')
  .option('team', {
    alias: 't',
    describe: 'Team name based on Drupal URL.',
    choices: [
      'blazers',      'bucks',    'bulls',
      'cavaliers',    'celtics',  'clippers',
      'grizzlies',    'hawks',    'heat',
      'hornets',      'jazz',     'kings',
      'knicks',       'lakers',   'magic',
      'mavericks',    'nets',     'nuggets',
      'pacers',       'pelicans', 'pistons',
      'raptors',      'rockets',  'sixers',
      'spurs',        'suns',     'thunder',
      'timberwolves', 'warriors', 'wizards'
    ],
    demandOption: true,
    type: 'string'
  })
  .option('username', {
    alias: 'u',
    describe: 'Login username to NBA Drupal.',
    type: 'string'
  })
  .option('password', {
    alias: 'p',
    describe: 'Login password to NBA Drupal.',
    type: 'string'
  })
  .option('clear-data', {
    describe: 'Clears checked pages progress, error log, and results.',
    type: 'boolean',
    default: false
  })
  .option('skip-errors', {
    alias: 's',
    describe: 'Keeps log of nodes with errors and, on subsequent runs, skips those nodes.',
    type: 'boolean',
    default: false
  })
  .help()
  .argv;

const username = (argv.username !== undefined) ? argv.username : prompt('username: ');
const password = (argv.password !== undefined) ? argv.password : prompt('password: ', {echo: '*'});
if(username === null || password === null) {
  console.log(chalk.red('Empty credentials'));
  process.exit(1);
}

console.log(chalk.cyan('Checking for files...'));
Object.entries(filenames).forEach(([key, path]) => fs.ensureFileSync(path));

if(argv.clearData) {
  console.log(chalk.cyan('Clear data flag enabled. Clearing...'));
  fs.truncateSync(filenames.checked, 0);
  console.log(`\tchecked pages progress (${filenames.checked})`);
  fs.truncateSync(filenames.errors, 0);
  console.log(`\terror log (${filenames.error})`);
  fs.truncateSync(filenames.errors, 0);
  console.log(`\terror list (${filenames.errorList})`);
  fs.truncateSync(filenames.results, 0);
  console.log(`\tresults (${filenames.results})`);
}

console.log(chalk.cyan('Loading files...'));
let checked = fs.readFileSync(filenames.checked)
                  .toString()
                  .split("\n");
if(argv.skipErrors) {
  const errors = fs.readFileSync(filenames.errorList)
                   .toString()
                   .split("\n");
  checked = checked.concat(errors);
}
const targets = fs.readFileSync(filenames.total)
                  .toString()
                  .split("\n")
                  .map(t => t.trim())
                  .filter(t => !checked.includes(t));
if(targets.length === 0) {
  console.log(chalk.red('No new nodes to check.'));
  process.exit(1);
} else {
  console.log(chalk.cyan(`${targets.length} nodes to check`));
}
const resultStream = fs.createWriteStream(filenames.results, {flags:'a'});
const errorStream = fs.createWriteStream(filenames.errors, {flags:'a'});
const errorListStream = fs.createWriteStream(filenames.errorList, {flags:'a'});
const checkedStream = fs.createWriteStream(filenames.checked, {flags:'a'});

var targetsChecked = 0;
var targetsSuccess = 0;
var targetsFailure = 0;
var targetsUnpublished = 0;
var mcWarnings = 0;
var mcErrors = 0;
var nid = 0;
var running = true;

(async() => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const failedReqs = {};

  async function endSession(close) {
    if(running) {
      summary();
      resultStream.end();
      checkedStream.end();
      errorStream.end();
      errorListStream.end();
      if(close) {
        running = false;
        browser.close().then(() => process.exit());
      }
    }
  }

  browser.on('disconnected', () => endSession());
  browser.on('targetdestroyed', frame => endSession(true));

  console.log(chalk.cyan('Logging into ') + `https://publish.nba.com/${argv.team}/user`);
  var response;
  try {
    response = await page.goto(`https://publish.nba.com/${argv.team}/user`);
    if(!response.ok()) {
      throw `Status code: ${response.status()}`
    }
    await page.type('#edit-name--2', username);
    await page.type('#edit-pass--2', password);
    await Promise.all([
      page.waitForNavigation(),
      page.click('#edit-submit--2')
    ]);
    if(page.url() == `https://publish.nba.com/${argv.team}/admin`) {
      console.log(chalk.green('\tSuccess'));
    } else {
      throw `Log in failed`
    }
  } catch (e) {
    console.log('\t'+chalk.red(e));
    process.exit(1);
  }

  page.setDefaultNavigationTimeout(15000)

  page.on('requestfailed', r => {
    failedReqs[r._requestId] = r.url();
  });

  page._client.on('Network.loadingFailed', r => {
    if (r['blockedReason'] == 'mixed-content') {
      console.log(chalk.red('\tBlockable: ') + failedReqs[r['requestId']]);
      resultStream.write(`Blockable,${nid},${failedReqs[r['requestId']]}\n`);
      mcErrors++;
    }
  });

  page._client.on('Network.requestWillBeSent', r => {
    if (r['request']['mixedContentType'] == 'optionally-blockable') {
      console.log(chalk.yellow('\tOptionally Blockable: ') + r.request.url);
      resultStream.write(`Optionally Blockable,${nid},${r.request.url}\n`);
      mcWarnings++;
    }
  });

  for (nid of targets) {
    let t = `https://publish.nba.com/${argv.team}/node/${nid}`;
    console.log(chalk.cyan('Checking ') + t + ' ...');
    try {
      response = await page.goto(t);
      if(!response.ok()) {
        var status = response.status();
        console.log('\t' + chalk.red(status));
        throw `Status code: ${status}`
      }
      let publishedStatus = await page.$('.node-unpublished');
      if(publishedStatus !== null) {
        console.log(chalk.yellow('\tUnpublished Page'));
        resultStream.write(`Unpublished Page,${nid},\n`);
        targetsUnpublished++;
      }
      checkedStream.write(nid + "\n");
      targetsSuccess++;
    } catch(e) {
      console.log('\t'+chalk.red(e));
      errorStream.write(`Error,${nid},${e}\n`);
      errorListStream.write(nid + "\n")
      targetsFailure++;
    }
    targetsChecked++;
  }
  endSession(true);
})();

function summary() {
  console.log(
    '\n' + chalk.cyan('Summary') +
    '\nTargets checked: ' + targetsChecked +
    '\n\tsuccess: ' + targetsSuccess +
    '\n\tfailure: ' + targetsFailure +
    '\n\tunpublished: ' + targetsUnpublished +
    '\nBlockable content: ' + mcErrors +
    '\nOptionally blockable content: ' + mcWarnings
  );
}