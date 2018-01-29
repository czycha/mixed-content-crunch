# mixed-content-crunch (MCC)

**mixed-content-crunch** (MCC) is a tool to check for NBA team site nodes for mixed content.

## Requirements

- [Node.js](https://nodejs.org/en/)
- Log-in information to the NBA website

## Running check

```
./mcc.js <--team TEAM NAME> [--username USERNAME] [--password PASSWORD] [--clear-data] [--skip-errors]
```

- **Team name** (--team, -t). Required option for your team name as it appears in your team site URL (for example, the Trail Blazers have "blazers" and the 76ers have "sixers").
- **Username** (--username, -u). Your username for logging into NBA's Drupal. If not defined here, an interactive prompt will have you provide it. (alias: -u)
- **Password** (--password, -p). Your password for logging into NBA's Drupal. If not defined here, an interactive prompt will have you provide it. (alias: -p)
- **Skip errors** (--skip-errors, -s). MCC keeps track of NIDs that encountered errors by default. Enabling this option, allows you to skip such nodes. This way, when returning to this task, you're not stuck waiting for pages that will most likely error out.
- **Clear data** (--clear-data). If you include this option, you will be **_starting fresh_** by clearing out the error and result logs as well as the progress.

### Outputs

#### Results: nodes.results.csv

Results of checking for mixed content. Will update as the program goes through. Even pages that eventually throw errors will have mixed content reports here.

```
Type,NID,Additional info
```

##### Result types

- **Unpublished.** This node is unpublished and so has low-impact if it has any mixed content. No additional info for the result type.
- **Blockable.** This node has blockable mixed content. The additional info is the URL for the content.
- **Optionally Blockable.** This node has optionally blockable mixed content. The additional info is the URL for the content.

#### Error log: nodes.errors.csv

List of errors received when checking nodes.

```
Error,NID,Error text
```

## Generating todo list

Generates a todo list based on the results.

```
./todo.js
```

### todo.csv

```
ID,Blockable,Optionally Blockable,Published,Unpublished,Error
```

- **ID.** Node ID.
- **Blockable.** Amount of blockable resources.
- **Optionally Blockable.** Amount of optionally blockable resources.
- **Published.** Is the node is published?
- **Unpublished.** Is the node unpublished?
- **Error.** Did the page result in an error? It is suggested that you check these pages manually in case a mixed content resource was not logged before the page errored out.

## Why?

NBA.com is moving over to HTTPS and many resources on team sites are insecure. We were provided by the NBA with a generated list of insecure nodes. However, this list is subject to change, especially after fixing templates that create widespread changes. We need to recheck for mixed content, but this is tedious to do manually since one has to wait for the page to entirely load and check the developer's tools for mixed content warnings.

## Process

MCC is based off of [mcdetect](https://github.com/agis/mcdetect) which utilizes [Puppeteer](https://github.com/GoogleChrome/puppeteer), a headless Chrome API, to check for mixed content on pages. The difference is that MCC is oriented specifically to the task of analyzing an NBA team site. 

To do this, it requires Drupal log-in information and a list of node IDs (NIDs) which is saved in **_output/nids.csv_** (one NID per line). After successfully logging in, MCC visits each given node, waits for its resources to load, and uses Chrome's API to detect mixed content. It saves a log of found mixed content resources in **_output/results.csv_** and errors in **_output/errors.csv_**. 

As it successfully checks each node (meaning no errors), MCC keeps track of processed nodes in **_output/checked.csv_**. This way, you can quit the long process and resume at a different time. Unsuccessful checks are not only saved in the error log, but also in a list of NIDs (**_output/error-nids.csv_**). This allows you the option to skip those pages which resulted in errors.

**_NOTE:_** MCC is a wolf, not a spider. It will only check nodes listed by NID in **_output/nids.csv_**. It will not try to discover new pages. If you are afraid that new content might be insecure, you may need to develop a list of NIDs of nodes that were added or updated after the NBA ran their initial test.

### Why log-in?

It would have been ideal to not add the extra step of logging into Drupal and just running mcdetect or similar scripts naturally. However, this is not possible. There's currently no publicly-accessible secure pages on NBA team sites and, because it's not easy to detect insecure content on already insecure pages, you need to be logged-in to access the secure site and run tests.

### Why not check resource URLs on the page?

A decent way to detect mixed content is to basically search resource URLs for "http:" when on a secure site. This is probably what browsers do internally. However, this assumes that every URL of every resource that can be possibly loaded into the page can be found. This is not always the case. Going through our own site, we found cases where JavaScript or CSS files were loading insecure content. Since Puppeteer operates just like a real browser, it will execute CSS and JS which can in turn try to load insecure content.

### Is this 100% accurate?

No. As discussed in the hypothetical situation above, MCC will detect attempts to load insecure resources. However, on some more interactive pages, there might be a trigger to load more content (clicking a button, submitting a form, etc.). In this edge case, the script, which will not interact with the page, will fail to detect these conditionally loaded resources. However, it is most likely that the NBA did not detect such cases in their initial report anyway.
