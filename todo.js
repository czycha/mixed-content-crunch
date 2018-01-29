#!/usr/bin/env node

const fs = require('fs-extra');
const Papa = require('papaparse');
const filenames = require('./filenames.json');

const results = Papa.parse(fs.readFileSync(filenames.results).toString()).data;
const errors = fs.readFileSync(filenames.errorList)
                 .toString()
                 .split("\n");
let tally = {};
let total = {
	"Blockable": 0,
	"Optionally Blockable": 0,
	"Unpublished": 0,
	"Published": 0,
	"Errors": 0
}
errors.forEach((nid) => {
	if(nid === '') {
		return;
	}
	if(tally[nid] === undefined) {
		tally[nid] = {
			"Blockable": 0,
			"Optionally Blockable": 0,
			"Published": true,
			"Error": true
		}
		total['Errors']++;
	}
});
results.forEach((row) => {
	let [issue, nid, info] = row;
	if(nid === undefined) {
		return;
	}
	if(tally[nid] === undefined) {
		tally[nid] = {
			"Blockable": 0,
			"Optionally Blockable": 0,
			"Published": true,
			"Error": false
		}
	}
	if(issue == 'Unpublished Page') {
		tally[nid]["Published"] = false;
		total["Unpublished"]++;
	} else {
		tally[nid][issue]++;
		total[issue]++;
	}
});
total["Published"] = Object.entries(tally).reduce((acc, [nid, t]) => acc + t["Published"], 0);
let csv = [
	['ID', 'Blockable', 'Optionally Blockable', 'Published', 'Unpublished', 'Error'],
	['Total', total["Blockable"], total["Optionally Blockable"], total["Published"], total["Unpublished"], total['Errors']]
];
Object.entries(tally).forEach(([nid, t]) => {
	csv.push([nid, t["Blockable"], t["Optionally Blockable"], t["Published"], !t["Published"], t['Error']])
});
fs.outputFile(filenames.todo, Papa.unparse(csv));
